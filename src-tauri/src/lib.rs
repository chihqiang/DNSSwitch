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
            commands::dns::resolve_dns,
            commands::dns::check_dns_leak,
            commands::dns::get_history,
            commands::dns::clear_history,
            commands::dns::record_event,
            commands::config::load_config,
            commands::config::save_config,
            commands::config::export_config,
            commands::config::import_config,
            commands::system::get_system_info,
            commands::system::get_network_services,
            commands::dns::resolve_dns_doh,
            commands::dns::resolve_dns_dot,
            commands::dns::test_doh_connectivity,
            commands::dns::test_dot_connectivity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
