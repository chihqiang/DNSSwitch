use std::time::{SystemTime, UNIX_EPOCH};

use crate::dns::doh;
use crate::dns::dot;
use crate::dns::history;
use crate::dns::history::DnsEvent;
use crate::dns::query;
use crate::dns::resolver;
use crate::dns::system_dns;
use crate::dns::types::{DnsLatencyResult, DnsLeakResult, DnsStatus};

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn new_id() -> String {
    format!("evt-{}", now_millis())
}

#[tauri::command]
pub fn get_current_dns() -> Result<DnsStatus, String> {
    system_dns::get_current_dns_status().map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn switch_dns(
    app_handle: tauri::AppHandle,
    server_id: String,
    server_name: String,
    addresses: Vec<String>,
) -> Result<(), String> {
    switch_dns_inner(&app_handle, server_id, server_name, addresses)
}

pub fn switch_dns_inner(
    app_handle: &tauri::AppHandle,
    server_id: String,
    server_name: String,
    addresses: Vec<String>,
) -> Result<(), String> {
    match system_dns::switch_to_dns(&server_id, &addresses) {
        Ok(()) => {
            let latency = addresses.first().and_then(|addr| resolver::measure_latency(addr).ok());
            let _ = history::add_event(DnsEvent {
                id: new_id(),
                event_type: "switch".to_string(),
                server_name: server_name.clone(),
                addresses: addresses.clone(),
                latency_ms: latency,
                success: true,
                detail: None,
                timestamp: now_millis(),
            });
            send_notification(app_handle, "DNS Switched", &format!("Switched to {}", server_name));
            let _ = crate::rebuild_tray_menu(app_handle);
            Ok(())
        }
        Err(e) => {
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

fn send_notification(_app_handle: &tauri::AppHandle, title: &str, body: &str) {
    let config = crate::config::load_config().ok();
    if config.map(|c| c.settings.notify_on_switch).unwrap_or(false) {
        let _ = std::process::Command::new("osascript")
            .args(["-e", &format!("display notification \"{}\" with title \"{}\"", body, title)])
            .output();
    }
}

#[tauri::command]
pub fn reset_system_dns(app_handle: tauri::AppHandle) -> Result<(), String> {
    reset_system_dns_inner(&app_handle)
}

pub fn reset_system_dns_inner(app_handle: &tauri::AppHandle) -> Result<(), String> {
    match system_dns::reset_to_system_dns() {
        Ok(()) => {
            let _ = history::add_event(DnsEvent {
                id: new_id(),
                event_type: "reset".to_string(),
                server_name: "System DNS".to_string(),
                addresses: Vec::new(),
                latency_ms: None,
                success: true,
                detail: None,
                timestamp: now_millis(),
            });
            send_notification(app_handle, "DNS Reset", "Reset to system default DNS");
            let _ = crate::rebuild_tray_menu(app_handle);
            Ok(())
        }
        Err(e) => {
            let _ = history::add_event(DnsEvent {
                id: new_id(),
                event_type: "reset".to_string(),
                server_name: "System DNS".to_string(),
                addresses: Vec::new(),
                latency_ms: None,
                success: false,
                detail: Some(e.message.clone()),
                timestamp: now_millis(),
            });
            Err(e.message)
        }
    }
}

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

#[tauri::command(rename_all = "camelCase")]
pub fn check_dns_leak(expected_addresses: Vec<String>) -> Result<DnsLeakResult, String> {
    let actual = system_dns::get_current_dns_status().map_err(|e| e.message)?;

    let mut actual_sorted: Vec<String> = actual.current_servers.clone();
    actual_sorted.sort();
    let mut expected_sorted = expected_addresses.clone();
    expected_sorted.sort();

    let matched = actual_sorted == expected_sorted && !actual_sorted.is_empty();

    let reachable = if let Some(addr) = expected_addresses.first() {
        resolver::measure_latency(addr).ok()
    } else {
        None
    };

    let detail = if !matched {
        format!(
            "Leak detected! System is using: {}. Expected: {}",
            if actual_sorted.is_empty() { "system default (DHCP)".to_string() } else { actual_sorted.join(", ") },
            expected_sorted.join(", ")
        )
    } else if reachable.is_none() {
        "DNS set but server is unreachable".to_string()
    } else {
        format!("OK - system using {}", actual_sorted.join(", "))
    };

    Ok(DnsLeakResult {
        expected_servers: expected_addresses,
        actual_servers: actual.current_servers,
        leak_detected: !matched,
        is_reachable: reachable.is_some(),
        latency_ms: reachable,
        detail,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn get_history() -> Result<Vec<history::DnsEvent>, String> {
    history::load_history().map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn clear_history() -> Result<(), String> {
    history::save_history(&[]).map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn resolve_dns(domain: String, record_type: String, address: String) -> Result<query::DnsQueryResult, String> {
    query::resolve(&domain, &record_type, &address).map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn test_dns_latency(server_id: String, address: String) -> Result<DnsLatencyResult, String> {
    match resolver::measure_latency(&address) {
        Ok(latency_ms) => Ok(DnsLatencyResult {
            server_id,
            address,
            latency_ms,
            success: true,
            error: None,
        }),
        Err(e) => Ok(DnsLatencyResult {
            server_id,
            address,
            latency_ms: f64::default(),
            success: false,
            error: Some(e.message),
        }),
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn resolve_dns_doh(domain: String, record_type: String, doh_url: String) -> Result<query::DnsQueryResult, String> {
    doh::resolve_via_doh(&domain, &record_type, &doh_url)
        .await
        .map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn resolve_dns_dot(domain: String, record_type: String, dot_address: String) -> Result<query::DnsQueryResult, String> {
    dot::resolve_via_dot(&domain, &record_type, &dot_address).map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub async fn test_doh_connectivity(doh_url: String) -> Result<f64, String> {
    doh::test_doh_connectivity(&doh_url).await.map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn test_dot_connectivity(dot_address: String) -> Result<f64, String> {
    dot::test_dot_connectivity(&dot_address).map_err(|e| e.message)
}
