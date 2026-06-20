use std::fs;

use crate::config;
use crate::config::types::AppConfig;

#[tauri::command]
pub fn load_config() -> Result<AppConfig, String> {
    config::load_config().map_err(|e| e.message)
}

#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config::save_config(&config).map_err(|e| e.message)?;
    let _ = crate::rebuild_tray_menu(&app_handle);
    Ok(())
}

#[tauri::command(rename_all = "camelCase")]
pub fn export_config(file_path: String) -> Result<String, String> {
    let config = config::load_config().map_err(|e| e.message)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&file_path, &json).map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(json)
}

#[tauri::command(rename_all = "camelCase")]
pub fn import_config(file_path: String) -> Result<AppConfig, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid config file: {}", e))?;
    config::save_config(&config).map_err(|e| e.message)?;
    Ok(config)
}
