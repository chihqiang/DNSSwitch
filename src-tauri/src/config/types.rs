use serde::{Deserialize, Serialize};

use crate::dns::types::DnsServer;

const CONFIG_VERSION: u32 = 1;
const DEFAULT_LATENCY_CHECK_INTERVAL_MS: u64 = 60000;
pub const THEME_MODE_SYSTEM: &str = "system";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub version: u32,
    pub servers: Vec<DnsServer>,
    pub schedule: ScheduleConfig,
    pub settings: AppSettings,
    pub theme: ThemeConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleConfig {
    pub enabled: bool,
    pub rules: Vec<ScheduleRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub condition: ScheduleCondition,
    pub action: ScheduleAction,
    pub priority: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScheduleCondition {
    Time {
        time_range: TimeRange,
        days_of_week: Vec<u32>,
    },
    Network {
        ssid: Option<String>,
        interface_name: Option<String>,
    },
    Always,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeRange {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleAction {
    pub target_server_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub check_updates: bool,
    pub notify_on_switch: bool,
    pub latency_check_interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub mode: String,
}

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
