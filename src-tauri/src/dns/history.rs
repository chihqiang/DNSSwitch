use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

static EVENTS: Mutex<Option<Vec<DnsEvent>>> = Mutex::new(None);

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
    pub detail: Option<String>,
    pub timestamp: u64,
}

fn events() -> Vec<DnsEvent> {
    EVENTS.lock().unwrap().clone().unwrap_or_default()
}

fn set_events(list: Vec<DnsEvent>) {
    *EVENTS.lock().unwrap() = Some(list);
}

/// 加载全部历史事件（当前 session 内存，非持久化）
pub fn load_history() -> Result<Vec<DnsEvent>, AppError> {
    Ok(events())
}

/// 添加事件：写入日志 + 内存（保留最近 200 条）
pub fn add_event(event: DnsEvent) -> Result<(), AppError> {
    let detail_str = event.detail.as_deref().unwrap_or("");
    let latency_str = event
        .latency_ms
        .map(|l| format!("{:.1}ms", l))
        .unwrap_or_default();
    let addrs = event.addresses.join(", ");

    log::info!(
        "[history] {}|{}|{}|{}|{}|{}",
        event.event_type,
        if event.success { "success" } else { "FAIL" },
        event.server_name,
        addrs,
        latency_str,
        detail_str
    );

    let mut list = events();
    list.insert(0, event);
    list.truncate(200);
    set_events(list);
    Ok(())
}

/// 清空历史
pub fn clear_history() -> Result<(), AppError> {
    set_events(Vec::new());
    Ok(())
}

/// 迁移旧的 history.json 到日志文件（启动时调用）
pub fn migrate_from_file() {
    let path = match crate::config::data_dir() {
        Ok(d) => d.join("history.json"),
        Err(_) => return,
    };
    if !path.exists() {
        return;
    }
    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            log::warn!("[history] Failed to read old history.json: {}", e);
            return;
        }
    };
    let events: Vec<DnsEvent> = match serde_json::from_str(&content) {
        Ok(e) => e,
        Err(e) => {
            log::warn!("[history] Failed to parse old history.json: {}", e);
            return;
        }
    };
    for event in &events {
        let latency = event.latency_ms.map(|l| format!("{:.1}ms", l)).unwrap_or_default();
        let addrs = event.addresses.join(", ");
        log::info!(
            "[history:migrated] {}|{}|{}|{}|{}|{}|{}",
            event.event_type,
            if event.success { "success" } else { "FAIL" },
            event.server_name,
            addrs,
            latency,
            event.detail.as_deref().unwrap_or(""),
            event.timestamp,
        );
    }
    if let Err(e) = std::fs::remove_file(&path) {
        log::warn!("[history] Failed to remove old history.json: {}", e);
    } else {
        log::info!("[history] Migrated {} events from history.json, file removed", events.len());
    }
}
