mod commands;
mod config;
mod dns;
mod error;

use std::sync::OnceLock;

use tauri::image::Image;
use tauri::menu::{IsMenuItem, Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

static TRAY: OnceLock<TrayIcon<tauri::Wry>> = OnceLock::new();

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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    use tauri_plugin_global_shortcut::{Code, ShortcutState};
                    if event.state == ShortcutState::Pressed
                        && shortcut.matches(tauri_plugin_global_shortcut::Modifiers::CONTROL | tauri_plugin_global_shortcut::Modifiers::SHIFT, Code::KeyD)
                    {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();

            dns::monitor::spawn_monitor(handle.clone());
            dns::schedule::spawn_schedule_engine(handle.clone());

            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            app.global_shortcut()
                .register("Ctrl+Shift+D")
                .expect("Failed to register global shortcut");

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
    let icon = {
        let img = image::load_from_memory(include_bytes!("../icons/32x32.png"))
            .expect("Failed to load tray icon")
            .into_rgba8();
        let (width, height) = img.dimensions();
        Image::new_owned(img.into_raw(), width, height)
    };

    let initial_menu = build_tray_menu(app.handle())?;

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&initial_menu)
        .on_menu_event(|app, event| handle_tray_menu_event(app, &event))
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

    TRAY.set(tray).ok();
    Ok(())
}

fn handle_tray_menu_event(app: &tauri::AppHandle, event: &tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => {
            app.exit(0);
        }
        "reset_dns" => {
            if let Err(e) = commands::dns::reset_system_dns_inner(app) {
                eprintln!("Failed to reset DNS: {}", e);
            }
        }
        id if id.starts_with("switch_") => {
            let server_id = id.strip_prefix("switch_").unwrap_or("");
            if let Ok(config) = config::load_config() {
                if let Some(server) = config.servers.iter().find(|s| s.id == server_id) {
                    if let Err(e) = commands::dns::switch_dns_inner(
                        app,
                        server.id.clone(),
                        server.name.clone(),
                        server.addresses.clone(),
                    ) {
                        eprintln!("Failed to switch DNS: {}", e);
                    }
                }
            }
        }
        _ => {}
    }
}

pub fn rebuild_tray_menu(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_tray_menu(app)?;
    if let Some(tray) = TRAY.get() {
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

fn build_tray_menu(
    app: &tauri::AppHandle,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let config = config::load_config().ok();

    let show = MenuItemBuilder::with_id("show", "Show DNSSwitch").build(app)?;

    let current_server = config
        .as_ref()
        .and_then(|c| c.servers.iter().find(|s| s.is_active));
    let dns_label = match current_server {
        Some(s) => format!("DNS: {} ({})", s.name, s.addresses.first().unwrap_or(&"?".to_string())),
        None => "DNS: System Default".to_string(),
    };
    let dns_status = MenuItemBuilder::with_id("dns_status", &dns_label)
        .enabled(false)
        .build(app)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let sep4 = PredefinedMenuItem::separator(app)?;

    let reset = MenuItemBuilder::with_id("reset_dns", "Reset to System DNS").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    // Build server items (keep owned alive until menu is built)
    let mut server_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    if let Some(ref cfg) = config {
        for server in &cfg.servers {
            let label = if server.is_active {
                format!("✓ {}", server.name)
            } else {
                server.name.clone()
            };
            let item =
                MenuItemBuilder::with_id(&format!("switch_{}", server.id), &label).build(app)?;
            server_items.push(item);
        }
    }
    let server_refs: Vec<&dyn IsMenuItem<tauri::Wry>> =
        server_items.iter().map(|i| i as &dyn IsMenuItem<tauri::Wry>).collect();

    let mut items: Vec<&dyn IsMenuItem<tauri::Wry>> = Vec::new();
    items.push(&show);
    items.push(&sep1);
    items.push(&dns_status);
    items.push(&sep2);
    items.extend(server_refs);
    items.push(&sep3);
    items.push(&reset);
    items.push(&sep4);
    items.push(&quit);

    let menu = Menu::with_items(app, &items)?;
    Ok(menu)
}


