use crate::config;
use crate::config::types::AppConfig;

#[tauri::command]
pub fn load_config() -> Result<AppConfig, String> {
    config::load_config().map_err(|e| e.message)
}

#[tauri::command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    config::save_config(&config).map_err(|e| e.message)
}
