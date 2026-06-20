// ============================================================
// 配置数据类型定义
// AppConfig 为顶层配置，包含服务器、调度、设置、主题四大板块
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
    pub schedule: ScheduleConfig,
    pub settings: AppSettings,
    pub theme: ThemeConfig,
}

/// 定时调度配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleConfig {
    pub enabled: bool,
    pub rules: Vec<ScheduleRule>,
}

/// 调度规则实体
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    /// 触发条件（时间/网络/Cron/启动/始终）
    pub condition: ScheduleCondition,
    /// 匹配后执行的操作
    pub action: ScheduleAction,
    /// 优先级，数字越小越优先
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// 调度触发条件枚举
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScheduleCondition {
    /// 基于时间段 + 星期几
    Time {
        time_range: TimeRange,
        days_of_week: Vec<u32>,
    },
    /// 基于当前连接的 Wi-Fi 网络
    Network {
        ssid: Option<String>,
        interface_name: Option<String>,
    },
    /// 基于标准 Cron 表达式
    Cron {
        expression: String,
    },
    /// 应用启动时触发（仅一次）
    Startup,
    /// 始终匹配
    Always,
}

/// 时间段（HH:MM 格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeRange {
    pub start: String,
    pub end: String,
}

/// 调度动作：切换到指定 DNS 服务器
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleAction {
    pub target_server_id: String,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 开机自启
    pub auto_start: bool,
    /// 关闭时最小化到托盘
    pub minimize_to_tray: bool,
    /// 自动检查更新
    pub check_updates: bool,
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

/// 默认配置：调度关闭，最小化托盘开启，自动更新和通知开启
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            servers: Vec::new(),
            schedule: ScheduleConfig {
                enabled: false,
                rules: Vec::new(),
            },
            settings: AppSettings {
                auto_start: false,
                minimize_to_tray: true,
                check_updates: true,
                notify_on_switch: true,
                latency_check_interval: DEFAULT_LATENCY_CHECK_INTERVAL_MS,
            },
            theme: ThemeConfig {
                mode: THEME_MODE_SYSTEM.to_string(),
            },
        }
    }
}
