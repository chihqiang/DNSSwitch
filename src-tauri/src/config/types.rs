// ============================================================
// 配置数据类型定义
// AppConfig 为顶层配置，包含服务器、设置、主题三大板块
// ============================================================

use serde::{Deserialize, Serialize};

use crate::dns::types::DnsServer;

/// 配置文件版本号
const CONFIG_VERSION: u32 = 1;
/// 默认延迟检查间隔（60 秒）
const DEFAULT_LATENCY_CHECK_INTERVAL_MS: u64 = 60000;
/// 应用数据目录名（位于用户 HOME 下）
pub const DATA_DIR: &str = ".dnsswitch";
/// 主题模式常量
pub const THEME_MODE_SYSTEM: &str = "system";

/// 应用顶层配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub servers: Vec<DnsServer>,
    /// 当前激活的 DNS 服务器 ID（None 表示使用系统默认 DNS）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_server_id: Option<String>,
    pub settings: AppSettings,
    pub theme: ThemeConfig,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 开机自启
    pub auto_start: bool,
    /// 关闭时最小化到托盘
    pub minimize_to_tray: bool,
    /// DNS 切换时显示通知
    pub notify_on_switch: bool,
    /// 延迟检查间隔（毫秒）
    pub latency_check_interval: u64,
}

/// 主题配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    /// system / light / dark
    pub mode: String,
}

/// 默认配置：调度关闭，最小化托盘开启，通知开启
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            servers: Vec::new(),
            active_server_id: None,
            settings: AppSettings {
                auto_start: false,
                minimize_to_tray: true,
                notify_on_switch: true,
                latency_check_interval: DEFAULT_LATENCY_CHECK_INTERVAL_MS,
            },
            theme: ThemeConfig {
                mode: THEME_MODE_SYSTEM.to_string(),
            },
        }
    }
}
