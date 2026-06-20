use serde::Serialize;

use crate::config;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleStatus {
    pub running: bool,
    pub enabled: bool,
    pub rule_count: usize,
}

#[tauri::command]
pub fn get_schedule_status() -> Result<ScheduleStatus, String> {
    let config = config::load_config().map_err(|e| e.message)?;
    Ok(ScheduleStatus {
        running: config.schedule.enabled,
        enabled: config.schedule.enabled,
        rule_count: config.schedule.rules.len(),
    })
}

#[tauri::command(rename_all = "camelCase")]
pub fn set_schedule_enabled(enabled: bool) -> Result<(), String> {
    let mut config = config::load_config().map_err(|e| e.message)?;
    config.schedule.enabled = enabled;
    config::save_config(&config).map_err(|e| e.message)?;
    Ok(())
}
