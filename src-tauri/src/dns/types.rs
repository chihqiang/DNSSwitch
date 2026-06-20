// ============================================================
// DNS 领域类型定义
// 包含 DNS 服务器、状态、延迟结果、泄露检测等核心数据结构
// ============================================================

use serde::{Deserialize, Serialize};

/// DNS 泄露检测结果
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

/// DNS 服务器实体
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsServer {
    pub id: String,
    pub name: String,
    pub addresses: Vec<String>,
    pub provider: DnsProvider,
    /// 当前延迟（毫秒），非持久化字段
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency: Option<f64>,
    /// 是否为当前激活的 DNS
    pub is_active: bool,
    /// 是否为系统默认 DNS
    pub is_system: bool,
    pub tags: Vec<String>,
    /// DNS-over-HTTPS 端点 URL（可选）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doh_url: Option<String>,
    /// DNS-over-TLS 服务器地址（可选，端口 853）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dot_address: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

/// DNS 供应商/来源信息
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

/// 当前系统 DNS 状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsStatus {
    pub current_servers: Vec<String>,
    pub network_service: String,
    pub is_custom: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency: Option<f64>,
}

/// DNS 延迟测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsLatencyResult {
    pub server_id: String,
    pub address: String,
    pub latency_ms: f64,
    pub success: bool,
    /// 失败时的错误消息
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
