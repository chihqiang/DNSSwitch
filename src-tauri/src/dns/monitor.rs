// ============================================================
// DNS 健康监控模块
// 在独立线程中周期性检测当前 DNS 的可达性、延迟和泄露状态
// 通过 Tauri 事件 "dns-health-changed" 推送结果到前端
// ============================================================

use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::Emitter;

use super::resolver::{measure_latency, resolve_domain};
use super::system_dns::get_current_dns_status;
use crate::config;

/// 用于健康检查的测试域名
const TEST_DOMAIN: &str = "one.one.one.one";

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

/// 启动 DNS 健康监控后台线程
/// 根据配置的检查间隔周期性执行检测，将健康事件推送到前端
pub fn spawn_monitor(app_handle: tauri::AppHandle) {
    thread::spawn(move || loop {
        if let Ok(config) = config::load_config() {
            // 最小间隔 5 秒，防止过于频繁
            let interval = config.settings.latency_check_interval.max(5000);

            let event = match config.servers.iter().find(|s| s.is_active) {
                Some(server) => {
                    let addr = server.addresses.first().cloned().unwrap_or_default();
                    if addr.is_empty() {
                        // 服务器没有配置地址
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
                        let resolved = resolve_domain(TEST_DOMAIN, &addr);
                        let actual = get_current_dns_status()
                            .ok()
                            .map(|s| s.current_servers)
                            .unwrap_or_default();
                        let leak = !actual.is_empty() && !actual.contains(&addr);

                        if leak {
                            log::warn!("[monitor] DNS leak: expected={}, actual={}", addr, actual.join(", "));
                        }

                        match (&latency, &resolved) {
                            // DNS 可达且解析正常
                            (Ok(lat), Ok(_)) => DnsHealthEvent {
                                healthy: true,
                                latency_ms: *lat,
                                server_name: server.name.clone(),
                                server_address: addr,
                                resolved: true,
                                leak_detected: leak,
                                error: if leak {
                                    Some("DNS leak detected".to_string())
                                } else {
                                    None
                                },
                                timestamp: now_millis(),
                            },
                            _ => {
                                let err_msg = latency
                                    .as_ref()
                                    .err()
                                    .or_else(|| resolved.as_ref().err())
                                    .map(|e| e.message.clone())
                                    .unwrap_or_default();
                                log::warn!("[monitor] Health check failed for {}: {}", server.name, err_msg);
                                DnsHealthEvent {
                                    healthy: false,
                                    latency_ms: latency.as_ref().unwrap_or(&0.0).to_owned(),
                                    server_name: server.name.clone(),
                                    server_address: addr,
                                    resolved: resolved.is_ok(),
                                    leak_detected: leak,
                                    error: Some(err_msg),
                                    timestamp: now_millis(),
                                }
                            }
                        }
                    }
                }
                // 没有激活的自定义 DNS 服务器时，检测系统 DNS
                None => {
                    let status = get_current_dns_status().ok();
                    match status.and_then(|s| s.current_servers.into_iter().next()) {
                        Some(addr) => {
                            let resolved = resolve_domain(TEST_DOMAIN, &addr);
                            match measure_latency(&addr) {
                                Ok(lat) => DnsHealthEvent {
                                    healthy: true,
                                    latency_ms: lat,
                                    server_name: "System DNS".to_string(),
                                    server_address: addr,
                                    resolved: resolved.is_ok(),
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
                            }
                        }
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

            // 通过 Tauri 事件系统推送健康状态到前端
            let _ = app_handle.emit("dns-health-changed", event);
            thread::sleep(Duration::from_millis(interval));
        } else {
            // 配置加载失败，等待 30 秒后重试
            thread::sleep(Duration::from_secs(30));
        }
    });
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
