use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLeakResult {
    pub expected_servers: Vec<String>,
    pub actual_servers: Vec<String>,
    pub leak_detected: bool,
    pub is_reachable: bool,
    pub latency_ms: Option<f64>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsServer {
    pub id: String,
    pub name: String,
    pub addresses: Vec<String>,
    pub provider: DnsProvider,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency: Option<f64>,
    pub is_active: bool,
    pub is_system: bool,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doh_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dot_address: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsProvider {
    pub name: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsStatus {
    pub current_servers: Vec<String>,
    pub network_service: String,
    pub is_custom: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLatencyResult {
    pub server_id: String,
    pub address: String,
    pub latency_ms: f64,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
