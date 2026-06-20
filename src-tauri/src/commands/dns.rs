use crate::dns::resolver;
use crate::dns::system_dns;
use crate::dns::types::{DnsLatencyResult, DnsStatus};

#[tauri::command]
pub fn get_current_dns() -> Result<DnsStatus, String> {
    system_dns::get_current_dns_status().map_err(|e| e.message)
}

#[tauri::command(rename_all = "camelCase")]
pub fn switch_dns(server_id: String, addresses: Vec<String>) -> Result<(), String> {
    system_dns::switch_to_dns(&server_id, &addresses).map_err(|e| e.message)
}

#[tauri::command]
pub fn reset_system_dns() -> Result<(), String> {
    system_dns::reset_to_system_dns().map_err(|e| e.message)
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
