// ============================================================
// Chrome DoH Tauri 命令
// Chrome DoH 的获取、设置、重置、安装检查等功能
// 与系统 DNS 完全独立
// ============================================================

/// 获取 Chrome 当前的 DoH 设置
#[tauri::command(rename_all = "camelCase")]
pub fn get_chrome_doh_status() -> Result<Option<String>, String> {
    crate::dns::chrome_dns::get_chrome_doh().map_err(|e| e.message)
}

/// 手动设置 Chrome DoH 策略
#[tauri::command(rename_all = "camelCase")]
pub fn set_chrome_doh(doh_url: String, server_id: String) -> Result<(), String> {
    crate::dns::chrome_dns::set_chrome_doh(&doh_url).map_err(|e| e.message)?;
    if let Ok(mut config) = crate::config::load_config() {
        config.active_chrome_server_id = Some(server_id);
        let _ = crate::config::save_config(&config);
    }
    Ok(())
}

/// 清除 Chrome DoH 策略
#[tauri::command(rename_all = "camelCase")]
pub fn reset_chrome_doh() -> Result<(), String> {
    crate::dns::chrome_dns::reset_chrome_doh().map_err(|e| e.message)?;
    if let Ok(mut config) = crate::config::load_config() {
        config.active_chrome_server_id = None;
        let _ = crate::config::save_config(&config);
    }
    Ok(())
}

/// 检查 Chrome 是否已安装
#[tauri::command(rename_all = "camelCase")]
pub fn is_chrome_installed() -> bool {
    crate::dns::chrome_dns::is_chrome_installed()
}

/// 获取 Chrome 版本号
#[tauri::command(rename_all = "camelCase")]
pub fn get_chrome_version() -> Option<String> {
    crate::dns::chrome_dns::get_chrome_version()
}
