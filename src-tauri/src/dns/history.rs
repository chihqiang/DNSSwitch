// ============================================================
// DNS 事件历史持久化
// 将 DNS 切换、重置等事件记录到 ~/.dnsswitch/history.json
// 最多保留最近 200 条记录
// ============================================================

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// DNS 操作事件记录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsEvent {
    pub id: String,
    pub event_type: String,
    pub server_name: String,
    pub addresses: Vec<String>,
    pub latency_ms: Option<f64>,
    pub success: bool,
    /// 失败或附加信息
    pub detail: Option<String>,
    pub timestamp: u64,
}

/// 获取历史记录文件路径：~/.dnsswitch/history.json
fn history_path() -> Result<PathBuf, AppError> {
    let home = std::env::var("HOME")
        .map_err(|_| AppError::new("Cannot determine home directory"))?;
    Ok(PathBuf::from(home).join(".dnsswitch").join("history.json"))
}

/// 加载全部历史事件
pub fn load_history() -> Result<Vec<DnsEvent>, AppError> {
    let path = history_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path)?;
    let events: Vec<DnsEvent> = serde_json::from_str(&content)?;
    Ok(events)
}

/// 添加事件到历史记录（插入到最前，截断至 200 条）
pub fn add_event(event: DnsEvent) -> Result<(), AppError> {
    let mut events = load_history()?;
    events.insert(0, event);
    events.truncate(200);
    save_history(&events)
}

/// 保存事件列表到磁盘
pub fn save_history(events: &[DnsEvent]) -> Result<(), AppError> {
    let path = history_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(events)?;
    fs::write(&path, content)?;
    Ok(())
}
