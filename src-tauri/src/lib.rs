mod commands;
mod config;
mod dns;
mod error;

use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let handle = app.handle().clone();

            dns::monitor::spawn_monitor(handle.clone());
            dns::schedule::spawn_schedule_engine(handle.clone());

            setup_tray(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Ok(config) = config::load_config() {
                    if config.settings.minimize_to_tray {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
            }
        })
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
            commands::schedule::get_schedule_status,
            commands::schedule::set_schedule_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
    let menu = MenuBuilder::new(app)
        .item(&show)
        .separator()
        .item(&quit)
        .build()?;

    let icon = {
        let img = image::load_from_memory(include_bytes!("../icons/32x32.png"))
            .expect("Failed to load tray icon")
            .into_rgba8();
        let (width, height) = img.dimensions();
        Image::new_owned(img.into_raw(), width, height)
    };

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
