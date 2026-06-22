// ============================================================
// DNS 相关 Tauri 命令
// 提供 DNS 切换、重置、延迟测试、解析查询、泄露检测、
// DoH/DoT 解析、历史记录等功能
// ============================================================

use std::time::{SystemTime, UNIX_EPOCH};

use crate::dns::doh;
use crate::dns::dot;
use crate::dns::history;
use crate::dns::history::DnsEvent;
use crate::dns::query;
use crate::dns::resolver;
use crate::dns::system_dns;
use crate::dns::types::{DnsLatencyResult, DnsLeakResult, DnsStatus};

/// 获取当前毫秒级时间戳
fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// 生成唯一事件 ID
fn new_id() -> String {
    format!("evt-{}", now_millis())
}

/// 获取当前系统 DNS 配置状态
#[tauri::command]
pub fn get_current_dns() -> Result<DnsStatus, String> {
    system_dns::get_current_dns_status().map_err(|e| e.message)
}

/// 切换到指定的 DNS 服务器（通过 Tauri 前端调用入口）
#[tauri::command(rename_all = "camelCase")]
pub fn switch_dns(
    app_handle: tauri::AppHandle,
    server_id: String,
    server_name: String,
    addresses: Vec<String>,
) -> Result<(), String> {
    switch_dns_inner(&app_handle, server_id, server_name, addresses)
}

/// DNS 切换内部实现（供托盘菜单等内部调用）
/// 只处理系统 DNS 切换，Chrome DoH 由独立按钮操作
pub fn switch_dns_inner(
    app_handle: &tauri::AppHandle,
    server_id: String,
    server_name: String,
    addresses: Vec<String>,
) -> Result<(), String> {
    let addrs: Vec<&str> = addresses.iter().map(|a| a.trim()).filter(|a| !a.is_empty()).collect();

    if addrs.is_empty() {
        return Err("No DNS addresses provided".to_string());
    }

    match system_dns::switch_to_dns(&server_id, &addresses) {
        Ok(()) => {
            log::info!("[dns] Switched system DNS to {} ({})", server_name, addresses.join(", "));
            if let Ok(mut config) = crate::config::load_config() {
                config.active_server_id = Some(server_id.clone());
                let _ = crate::config::save_config(&config);
            }
            let hist_name = server_name.clone();
            let hist_addrs = addresses.clone();
            let addr = addresses.first().cloned();
            std::thread::spawn(move || {
                let latency = addr.and_then(|a| resolver::measure_latency(&a).ok());
                let _ = history::add_event(DnsEvent {
                    id: new_id(),
                    event_type: "switch".to_string(),
                    server_name: hist_name,
                    addresses: hist_addrs,
                    latency_ms: latency,
                    success: true,
                    detail: None,
                    timestamp: now_millis(),
                });
            });
            send_notification(app_handle, "DNS Switched", &format!("Switched to {}", server_name));
            let _ = crate::rebuild_tray_menu(app_handle);
            Ok(())
        }
        Err(e) => {
            log::error!("[dns] Failed to switch system DNS to {}: {}", server_name, e.message);
            let _ = history::add_event(DnsEvent {
                id: new_id(),
                event_type: "switch".to_string(),
                server_name,
                addresses,
                latency_ms: None,
                success: false,
                detail: Some(e.message.clone()),
                timestamp: now_millis(),
            });
            Err(e.message)
        }
    }
}

use tauri_plugin_notification::NotificationExt;

/// 发送系统通知（跨平台，仅在用户开启通知设置时发送）
fn send_notification(app_handle: &tauri::AppHandle, title: &str, body: &str) {
    let config = crate::config::load_config().ok();
    if config.map(|c| c.settings.notify_on_switch).unwrap_or(false) {
        if let Err(e) = app_handle.notification().builder()
            .title(title)
            .body(body)
            .show()
        {
            log::error!("[dns] Failed to send notification: {}", e);
        }
    }
}

/// 重置 DNS 为系统默认（Tauri 命令入口）
#[tauri::command]
pub fn reset_system_dns(app_handle: tauri::AppHandle) -> Result<(), String> {
    reset_system_dns_inner(&app_handle)
}

/// 重置 DNS 为系统默认（内部实现，供托盘菜单调用）
pub fn reset_system_dns_inner(app_handle: &tauri::AppHandle) -> Result<(), String> {
    let mut success = true;
    let mut error_msg = String::new();

    if let Err(e) = system_dns::reset_to_system_dns() {
        if e.message == "CANCELLED" {
            log::info!("[dns] DNS reset cancelled by user");
        } else {
            log::error!("[dns] Failed to reset system DNS: {}", e.message);
        }
        success = false;
        error_msg = e.message;
    }

    if success {
        log::info!("[dns] Reset to default DNS");
        if let Ok(mut config) = crate::config::load_config() {
            config.active_server_id = None;
            let _ = crate::config::save_config(&config);
        }
        let _ = history::add_event(DnsEvent {
            id: new_id(),
            event_type: "reset".to_string(),
            server_name: "Default DNS".to_string(),
            addresses: Vec::new(),
            latency_ms: None,
            success: true,
            detail: None,
            timestamp: now_millis(),
        });
        send_notification(app_handle, "DNS Reset", "Reset to default DNS");
        let _ = crate::rebuild_tray_menu(app_handle);
        Ok(())
    } else {
        let _ = history::add_event(DnsEvent {
            id: new_id(),
            event_type: "reset".to_string(),
            server_name: "Default DNS".to_string(),
            addresses: Vec::new(),
            latency_ms: None,
            success: false,
            detail: Some(error_msg.clone()),
            timestamp: now_millis(),
        });
        Err(error_msg)
    }
}

/// 记录自定义 DNS 事件到历史
#[tauri::command(rename_all = "camelCase")]
pub fn record_event(event_type: String, server_name: String, addresses: Vec<String>, success: bool, detail: Option<String>) -> Result<(), String> {
    let _ = history::add_event(DnsEvent {
        id: new_id(),
        event_type,
        server_name,
        addresses,
        latency_ms: None,
        success,
        detail,
        timestamp: now_millis(),
    });
    Ok(())
}

/// 检测 DNS 泄露：比对系统当前 DNS 与预期的 DNS 地址是否一致
#[tauri::command(rename_all = "camelCase")]
pub fn check_dns_leak(expected_addresses: Vec<String>) -> Result<DnsLeakResult, String> {
    let actual = system_dns::get_current_dns_status().map_err(|e| e.message)?;

    let mut actual_sorted: Vec<String> = actual.current_servers.clone();
    actual_sorted.sort();
    let mut expected_sorted = expected_addresses.clone();
    expected_sorted.sort();

    let matched = actual_sorted == expected_sorted && !actual_sorted.is_empty();

    let detail = if !matched {
        log::warn!("[dns] DNS leak detected: expected={}, actual={}", expected_sorted.join(", "), if actual_sorted.is_empty() { "system default (DHCP)".to_string() } else { actual_sorted.join(", ") });
        format!(
            "Leak detected! System is using: {}. Expected: {}",
            if actual_sorted.is_empty() { "system default (DHCP)".to_string() } else { actual_sorted.join(", ") },
            expected_sorted.join(", ")
        )
    } else {
        format!("OK - system using {}", actual_sorted.join(", "))
    };

    Ok(DnsLeakResult {
        expected_servers: expected_addresses,
        actual_servers: actual.current_servers,
        leak_detected: !matched,
        is_reachable: true,
        latency_ms: None,
        detail,
    })
}

/// 获取 DNS 历史事件列表
#[tauri::command(rename_all = "camelCase")]
pub fn get_history() -> Result<Vec<history::DnsEvent>, String> {
    history::load_history().map_err(|e| e.message)
}

/// 清空 DNS 历史记录
#[tauri::command(rename_all = "camelCase")]
pub fn clear_history() -> Result<(), String> {
    history::clear_history().map_err(|e| e.message)
}

/// 通过指定 DNS 服务器解析域名（UDP 53 端口）
#[tauri::command(rename_all = "camelCase")]
pub fn resolve_dns(domain: String, record_type: String, address: String) -> Result<query::DnsQueryResult, String> {
    query::resolve(&domain, &record_type, &address)
        .inspect_err(|e| log::error!("[dns] UDP resolve {} ({}) via {}: {}", domain, record_type, address, e.message))
        .map_err(|e| e.message)
}

/// 测试指定 DNS 服务器的延迟
#[tauri::command(rename_all = "camelCase")]
pub fn test_dns_latency(server_id: String, address: String) -> Result<DnsLatencyResult, String> {
    match resolver::measure_latency(&address) {
        Ok(latency_ms) => {
            log::debug!("[dns] Latency test {}: {:.2}ms", address, latency_ms);
            Ok(DnsLatencyResult {
                server_id,
                address,
                latency_ms,
                success: true,
                error: None,
            })
        }
        Err(e) => {
            log::warn!("[dns] Latency test {} failed: {}", address, e.message);
            Ok(DnsLatencyResult {
                server_id,
                address,
                latency_ms: f64::default(),
                success: false,
                error: Some(e.message),
            })
        }
    }
}

/// 批量测试多个 DNS 服务器的延迟（Rust 端并行，一次 IPC 调用）
#[tauri::command(rename_all = "camelCase")]
pub fn test_all_dns_latency(servers: Vec<DnsLatencyInput>) -> Result<Vec<DnsLatencyResult>, String> {
    if servers.is_empty() {
        return Ok(Vec::new());
    }
    // 使用 scoped threads 并行测试所有地址
    let results = std::sync::Mutex::new(Vec::with_capacity(servers.len()));
    std::thread::scope(|s| {
        for input in &servers {
            s.spawn(|| {
                let result = match resolver::measure_latency(&input.address) {
                    Ok(latency_ms) => {
                        log::debug!("[dns] Latency test {}: {:.2}ms", input.address, latency_ms);
                        DnsLatencyResult {
                            server_id: input.server_id.clone(),
                            address: input.address.clone(),
                            latency_ms,
                            success: true,
                            error: None,
                        }
                    }
                    Err(e) => {
                        log::warn!("[dns] Latency test {} failed: {}", input.address, e.message);
                        DnsLatencyResult {
                            server_id: input.server_id.clone(),
                            address: input.address.clone(),
                            latency_ms: f64::default(),
                            success: false,
                            error: Some(e.message),
                        }
                    }
                };
                results.lock().unwrap().push(result);
            });
        }
    });
    Ok(results.into_inner().unwrap())
}

/// 批量延迟测试的输入参数
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLatencyInput {
    pub server_id: String,
    pub address: String,
}

/// 通过 DNS-over-HTTPS 解析域名
#[tauri::command(rename_all = "camelCase")]
pub async fn resolve_dns_doh(domain: String, record_type: String, doh_url: String) -> Result<query::DnsQueryResult, String> {
    doh::resolve_via_doh(&domain, &record_type, &doh_url)
        .await
        .inspect_err(|e| log::error!("[dns] DoH resolve {} ({}) via {}: {}", domain, record_type, doh_url, e.message))
        .map_err(|e| e.message)
}

/// 通过 DNS-over-TLS 解析域名
#[tauri::command(rename_all = "camelCase")]
pub fn resolve_dns_dot(domain: String, record_type: String, dot_address: String) -> Result<query::DnsQueryResult, String> {
    dot::resolve_via_dot(&domain, &record_type, &dot_address)
        .inspect_err(|e| log::error!("[dns] DoT resolve {} ({}) via {}: {}", domain, record_type, dot_address, e.message))
        .map_err(|e| e.message)
}

/// 测试 DoH 服务器连通性
#[tauri::command(rename_all = "camelCase")]
pub async fn test_doh_connectivity(doh_url: String) -> Result<f64, String> {
    doh::test_doh_connectivity(&doh_url)
        .await
        .inspect_err(|e| log::warn!("[dns] DoH connectivity test {}: {}", doh_url, e.message))
        .map_err(|e| e.message)
}

/// 测试 DoT 服务器连通性
#[tauri::command(rename_all = "camelCase")]
pub fn test_dot_connectivity(dot_address: String) -> Result<f64, String> {
    dot::test_dot_connectivity(&dot_address)
        .inspect_err(|e| log::warn!("[dns] DoT connectivity test {}: {}", dot_address, e.message))
        .map_err(|e| e.message)
}


