// 前端日志 IPC 桥接：接收前端日志消息，通过 Rust log crate 统一输出
#[tauri::command]
pub fn log_message(level: String, message: String) {
    match level.to_lowercase().as_str() {
        "error" => log::error!("[frontend] {message}"),
        "warn" => log::warn!("[frontend] {message}"),
        "info" => log::info!("[frontend] {message}"),
        "debug" => log::debug!("[frontend] {message}"),
        "trace" => log::trace!("[frontend] {message}"),
        _ => log::info!("[frontend] {message}"),
    }
}
