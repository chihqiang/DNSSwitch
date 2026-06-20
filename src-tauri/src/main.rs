// ============================================================
// DNSSwitch 应用入口
// 仅在 Windows release 模式下隐藏控制台窗口，其他平台直接启动
// ============================================================

// Windows 发布模式下作为 GUI 应用运行（不显示控制台窗口）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dnsswitch_lib::run()
}
