// ============================================================
// DNS 健康监控模块
// 后台线程周期性：并行测试全部服务器延迟、检测当前 DNS 健康/泄露
// 通过 Tauri 事件推送结果到前端，无需前端轮询
// ============================================================

use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Emitter;

use super::resolver::measure_latency;
use super::system_dns::get_current_dns_status;
use crate::config;

/// DNS 健康状态事件（推送到前端）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsHealthEvent {
    pub healthy: bool,
    pub latency_ms: f64,
    pub server_name: String,
    pub server_address: String,
    pub resolved: bool,
    pub leak_detected: bool,
    pub error: Option<String>,
    pub timestamp: u64,
}

/// 全部服务器延迟数据（推送到前端，一次事件包含全部结果）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLatencyUpdate {
    pub results: Vec<ServerLatency>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerLatency {
    pub server_id: String,
    pub latency_ms: f64,
    pub success: bool,
}

/// 启动 DNS 健康监控后台线程
pub fn spawn_monitor(app_handle: tauri::AppHandle) {
    thread::spawn(move || loop {
        if let Ok(config) = config::load_config() {
            let interval = config.settings.latency_check_interval.max(10000);

            // 并行测试全部服务器的延迟
            test_all_latency(&app_handle, &config);

            // 健康/泄露检测（仅针对当前活跃服务器）
            check_health(&app_handle, &config);

            thread::sleep(Duration::from_millis(interval));
        } else {
            thread::sleep(Duration::from_secs(30));
        }
    });
}

/// 并行测试全部服务器延迟，结果通过事件推送到前端
fn test_all_latency(app_handle: &tauri::AppHandle, config: &config::types::AppConfig) {
    let inputs: Vec<_> = config
        .servers
        .iter()
        .filter_map(|s| s.addresses.first().map(|a| (s.id.clone(), a.clone())))
        .collect();

    if inputs.is_empty() {
        return;
    }

    // scoped threads 并行执行全部 DNS 查询
    let results = std::sync::Mutex::new(Vec::with_capacity(inputs.len()));
    std::thread::scope(|s| {
        for (server_id, address) in &inputs {
            let sid = server_id.clone();
            let addr = address.clone();
            let res = &results;
            s.spawn(move || {
                let entry = match measure_latency(&addr) {
                    Ok(ms) => ServerLatency {
                        server_id: sid,
                        latency_ms: ms,
                        success: true,
                    },
                    Err(e) => {
                        log::warn!("[monitor] Latency test {} failed: {}", addr, e.message);
                        ServerLatency {
                            server_id: sid,
                            latency_ms: 0.0,
                            success: false,
                        }
                    }
                };
                res.lock().unwrap().push(entry);
            });
        }
    });

    let results = results.into_inner().unwrap();
    if !results.is_empty() {
        let _ = app_handle.emit(
            "dns-latency-changed",
            DnsLatencyUpdate {
                results,
                timestamp: now_millis(),
            },
        );
    }
}

/// 检测当前活跃 DNS 的健康状态和泄露
fn check_health(app_handle: &tauri::AppHandle, config: &config::types::AppConfig) {
    let event = match config.servers.iter().find(|s| s.is_active) {
        Some(server) => {
            let addr = server.addresses.first().cloned().unwrap_or_default();
            if addr.is_empty() {
                DnsHealthEvent {
                    healthy: true,
                    latency_ms: 0.0,
                    server_name: server.name.clone(),
                    server_address: String::new(),
                    resolved: false,
                    leak_detected: false,
                    error: Some("No address configured".to_string()),
                    timestamp: now_millis(),
                }
            } else {
                let latency = measure_latency(&addr);
                let actual = get_current_dns_status()
                    .ok()
                    .map(|s| s.current_servers)
                    .unwrap_or_default();
                let leak = !actual.is_empty() && !actual.contains(&addr);

                if leak {
                    log::warn!("[monitor] DNS leak: expected={}, actual={}", addr, actual.join(", "));
                }

                match latency {
                    Ok(ms) => DnsHealthEvent {
                        healthy: true,
                        latency_ms: ms,
                        server_name: server.name.clone(),
                        server_address: addr,
                        resolved: true,
                        leak_detected: leak,
                        error: if leak { Some("DNS leak detected".to_string()) } else { None },
                        timestamp: now_millis(),
                    },
                    Err(e) => {
                        log::warn!("[monitor] Health check failed for {}: {}", server.name, e.message);
                        DnsHealthEvent {
                            healthy: false,
                            latency_ms: 0.0,
                            server_name: server.name.clone(),
                            server_address: addr,
                            resolved: false,
                            leak_detected: leak,
                            error: Some(e.message),
                            timestamp: now_millis(),
                        }
                    }
                }
            }
        }
        None => {
            let status = get_current_dns_status().ok();
            match status.and_then(|s| s.current_servers.into_iter().next()) {
                Some(addr) => match measure_latency(&addr) {
                    Ok(ms) => DnsHealthEvent {
                        healthy: true,
                        latency_ms: ms,
                        server_name: "System DNS".to_string(),
                        server_address: addr,
                        resolved: true,
                        leak_detected: false,
                        error: None,
                        timestamp: now_millis(),
                    },
                    Err(e) => DnsHealthEvent {
                        healthy: false,
                        latency_ms: 0.0,
                        server_name: "System DNS".to_string(),
                        server_address: addr,
                        resolved: false,
                        leak_detected: false,
                        error: Some(e.message),
                        timestamp: now_millis(),
                    },
                },
                None => DnsHealthEvent {
                    healthy: false,
                    latency_ms: 0.0,
                    server_name: "System DNS".to_string(),
                    server_address: String::new(),
                    resolved: false,
                    leak_detected: false,
                    error: Some("No DNS server found".to_string()),
                    timestamp: now_millis(),
                },
            }
        }
    };

    let _ = app_handle.emit("dns-health-changed", event);
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
