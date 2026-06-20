// ============================================================
// 定时调度相关 Tauri 命令
// 提供调度状态的查询和启用/禁用切换
// ============================================================

use serde::Serialize;

use crate::config;

/// 调度状态信息（前端用于展示调度运行情况）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleStatus {
    pub running: bool,
    pub enabled: bool,
    pub rule_count: usize,
}

/// 获取当前调度引擎的运行状态
#[tauri::command]
pub fn get_schedule_status() -> Result<ScheduleStatus, String> {
    let config = config::load_config().map_err(|e| e.message)?;
    Ok(ScheduleStatus {
        running: config.schedule.enabled,
        enabled: config.schedule.enabled,
        rule_count: config.schedule.rules.len(),
    })
}

/// 启用或禁用调度引擎
#[tauri::command(rename_all = "camelCase")]
pub fn set_schedule_enabled(enabled: bool) -> Result<(), String> {
    let mut config = config::load_config().map_err(|e| e.message)?;
    config.schedule.enabled = enabled;
    config::save_config(&config).map_err(|e| e.message)?;
    Ok(())
}
