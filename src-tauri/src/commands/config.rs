// ============================================================
// 配置相关 Tauri 命令
// 提供配置的加载、保存、导出、导入功能
// ============================================================

use std::fs;

use crate::config;
use crate::config::types::AppConfig;

/// 加载应用配置
#[tauri::command]
pub fn load_config() -> Result<AppConfig, String> {
    config::load_config()
        .inspect_err(|e| log::error!("[config] Failed to load: {}", e.message))
        .map_err(|e| e.message)
}

/// 保存应用配置，并重建托盘菜单以反映最新状态
#[tauri::command]
pub fn save_config(app_handle: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config::save_config(&config).map_err(|e| e.message)?;
    log::info!("[config] Configuration saved ({})", config.servers.len());
    let _ = crate::rebuild_tray_menu(&app_handle);
    Ok(())
}

/// 导出配置到指定路径的 JSON 文件
#[tauri::command(rename_all = "camelCase")]
pub fn export_config(file_path: String) -> Result<String, String> {
    let config = config::load_config().map_err(|e| e.message)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&file_path, &json).map_err(|e| format!("Failed to write file: {}", e))?;
    log::info!("[config] Exported to {}", file_path);
    Ok(json)
}

/// 从指定路径的 JSON 文件导入配置
#[tauri::command(rename_all = "camelCase")]
pub fn import_config(file_path: String) -> Result<AppConfig, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid config file: {}", e))?;
    config::save_config(&config).map_err(|e| e.message)?;
    log::info!("[config] Imported from {}", file_path);
    Ok(config)
}
