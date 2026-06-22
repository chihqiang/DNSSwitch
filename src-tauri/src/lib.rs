// ============================================================
// DNSSwitch Tauri 应用核心
// 负责应用启动、插件注册、系统托盘菜单、全局快捷键、
// 窗口事件处理和 Tauri 命令注册
// ============================================================

mod commands;
mod config;
mod dns;
mod error;
mod logger;

use std::sync::OnceLock;

use tauri::image::Image;
use tauri::menu::{IsMenuItem, Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

/// 全局托盘图标实例（用于运行时更新菜单）
static TRAY: OnceLock<TrayIcon<tauri::Wry>> = OnceLock::new();

/// 应用主入口：配置 Tauri Builder、注册插件、启动监控和调度引擎
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统：stdout + 按日轮转文件
    let log_dir = config::data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("log");
    std::fs::create_dir_all(&log_dir).ok();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let log_file = log_dir.join(format!("{}.log", today));

    let mut dispatch = fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{} [{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f"),
                record.level(),
                message,
            ))
        })
        .level(log::LevelFilter::Debug)
        .chain(std::io::stdout());

    match fern::log_file(&log_file) {
        Ok(f) => dispatch = dispatch.chain(Box::new(std::io::BufWriter::new(f)) as Box<dyn std::io::Write + Send>),
        Err(e) => eprintln!("Warning: failed to open {}: {}", log_file.display(), e),
    }

    dispatch.apply().unwrap_or_else(|e| {
        eprintln!("Warning: failed to initialize logger: {}", e);
    });

    log::info!("dnsswitch starting");

    // 迁移旧的 history.json 到日志文件
    dns::history::migrate_from_file();

    tauri::Builder::default()
        // 文件/URL 打开插件
        .plugin(tauri_plugin_opener::init())
        // 文件对话框插件
        .plugin(tauri_plugin_dialog::init())
        // 自启动插件（macOS 使用 LaunchAgent）
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        // 系统通知插件
        .plugin(tauri_plugin_notification::init())
        // 全局快捷键插件（Ctrl+Shift+D 切换窗口显隐）
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

            // 启动后台健康监控线程
            dns::monitor::spawn_monitor(handle.clone());

            // 注册全局快捷键
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            app.global_shortcut()
                .register("Ctrl+Shift+D")
                .expect("Failed to register global shortcut");

            // 构建系统托盘
            setup_tray(app)?;

            Ok(())
        })
        // 窗口关闭事件：如果设置了最小化到托盘，则隐藏窗口而非退出
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
        // 注册所有 Tauri 命令处理器（供前端 invoke 调用）
        .invoke_handler(tauri::generate_handler![
            logger::log_message,
            logger::read_log_file,
            logger::clear_log_file,
            logger::clear_all_logs,
            commands::dns::get_current_dns,
            commands::dns::switch_dns,
            commands::dns::reset_system_dns,
            commands::dns::test_dns_latency,
            commands::dns::test_all_dns_latency,
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
            dns::provider::get_provider_registry,
            dns::provider::add_server_to_registry,
            dns::provider::update_server_in_registry,
            dns::provider::delete_server_from_registry,
            dns::provider::reset_provider_registry,
            commands::chrome::get_chrome_doh_status,
            commands::chrome::set_chrome_doh,
            commands::chrome::reset_chrome_doh,
            commands::chrome::is_chrome_installed,
            commands::chrome::get_chrome_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 初始化系统托盘：加载图标、构建菜单、注册事件处理器
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
        // 菜单项点击事件
        .on_menu_event(|app, event| handle_tray_menu_event(app, &event))
        // 左键点击托盘图标：显示/聚焦主窗口
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

/// 托盘菜单事件处理
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
                log::error!("[tray] Failed to reset DNS: {}", e);
            }
        }
        // 切换 DNS 菜单项：id 格式为 "switch_{server_id}"
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
                        log::error!("[tray] Failed to switch DNS: {}", e);
                    }
                }
            }
        }
        _ => {}
    }
}

/// 重建托盘菜单（DNS 切换后更新当前 DNS 状态标签和激活标记）
pub fn rebuild_tray_menu(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_tray_menu(app)?;
    if let Some(tray) = TRAY.get() {
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

/// 构建托盘菜单结构
fn build_tray_menu(
    app: &tauri::AppHandle,
) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let config = config::load_config().ok();

    // 顶部：显示主窗口
    let show = MenuItemBuilder::with_id("show", "Show DNSSwitch").build(app)?;

    // 当前 DNS 状态（不可点击的标签）
    let current_server = config
        .as_ref()
        .and_then(|c| c.servers.iter().find(|s| s.is_active));
    let dns_label = match current_server {
        Some(s) => format!("DNS: {} ({})", s.name, s.addresses.first().unwrap_or(&"?".to_string())),
        None => "DNS: Default".to_string(),
    };
    let dns_status = MenuItemBuilder::with_id("dns_status", &dns_label)
        .enabled(false)
        .build(app)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let sep4 = PredefinedMenuItem::separator(app)?;

    // 底部操作
    let reset = MenuItemBuilder::with_id("reset_dns", "Reset Default DNS").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    // 动态生成 DNS 服务器切换菜单项
    let mut server_items: Vec<MenuItem<tauri::Wry>> = Vec::new();
    if let Some(ref cfg) = config {
        for server in &cfg.servers {
            let label = if server.is_active {
                format!("✓ {}", server.name)
            } else {
                server.name.clone()
            };
            let id = format!("switch_{}", server.id);
            let item =
                MenuItemBuilder::with_id(&id, &label).build(app)?;
            server_items.push(item);
        }
    }
    let server_refs: Vec<&dyn IsMenuItem<tauri::Wry>> =
        server_items.iter().map(|i| i as &dyn IsMenuItem<tauri::Wry>).collect();

    // 组装菜单项顺序
    let items: Vec<&dyn IsMenuItem<tauri::Wry>> = vec![
        &show,
        &sep1,
        &dns_status,
        &sep2,
    ];
    let items = [items, server_refs, vec![&sep3, &reset, &sep4, &quit]].concat();

    let menu = Menu::with_items(app, &items)?;
    Ok(menu)
}
