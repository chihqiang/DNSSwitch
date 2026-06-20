mod commands;
mod config;
mod dns;
mod error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::dns::get_current_dns,
            commands::dns::switch_dns,
            commands::dns::reset_system_dns,
            commands::dns::test_dns_latency,
            commands::config::load_config,
            commands::config::save_config,
            commands::system::get_system_info,
            commands::system::get_network_services,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
