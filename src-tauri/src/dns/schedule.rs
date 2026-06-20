// ============================================================
// DNS 定时调度引擎
// 在后台线程中每 30 秒轮询一次，按优先级匹配调度规则
// 支持 Time（时间段+星期）、Network（Wi-Fi SSID）、Cron（cron 表达式）、
// Startup（启动时执行一次）、Always（始终匹配）五种条件类型
// ============================================================

use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{Datelike, Local, Timelike};
use serde::Serialize;
use tauri::Emitter;

use super::history::{self, DnsEvent};
use super::system_dns;
use crate::config;
use crate::config::types::ScheduleCondition;

/// 调度事件（推送到前端用于 Toast 通知）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleEvent {
    pub action: String,
    pub rule_name: String,
    pub target_server: String,
    pub error: Option<String>,
    pub timestamp: u64,
}

/// 启动调度引擎后台线程
pub fn spawn_schedule_engine(app_handle: tauri::AppHandle) {
    thread::spawn(move || {
        // 启动时执行标记（确保 Startup 条件只触发一次）
        let startup_executed = AtomicBool::new(false);
        loop {
            if let Ok(config) = config::load_config() {
                if config.schedule.enabled {
                    evaluate_rules(&app_handle, &config, &startup_executed);
                }
            }
            // 每 30 秒检查一次规则
            thread::sleep(Duration::from_secs(30));
        }
    });
}

/// 评估所有调度规则，按优先级从小到大排序后逐一匹配
/// 匹配后切换到目标 DNS（如已设置则跳过），命中后停止继续匹配
fn evaluate_rules(
    app_handle: &tauri::AppHandle,
    config: &config::types::AppConfig,
    startup_executed: &AtomicBool,
) {
    let current_status = system_dns::get_current_dns_status().ok();

    let mut rules: Vec<_> = config
        .schedule
        .rules
        .iter()
        .filter(|r| r.enabled)
        .collect();
    rules.sort_by_key(|r| r.priority);

    for rule in rules {
        if !condition_matches(&rule.condition, startup_executed) {
            continue;
        }

        let target = config.servers.iter().find(|s| s.id == rule.action.target_server_id);
        let target = match target {
            Some(t) => t,
            None => continue,
        };

        // 如果目标 DNS 已经是当前 DNS，跳过
        let already_set = current_status
            .as_ref()
            .map(|s| {
                let mut cur = s.current_servers.clone();
                let mut tgt = target.addresses.clone();
                cur.sort();
                tgt.sort();
                cur == tgt && !cur.is_empty()
            })
            .unwrap_or(false);

        if already_set {
            continue;
        }

        let addresses: Vec<String> = target.addresses.clone();
        log::info!("[schedule] Rule \"{}\" matched, switching to {}", rule.name, target.name);
        match system_dns::switch_to_dns(&target.id, &addresses) {
            Ok(()) => {
                // 记录到历史
                let _ = history::add_event(DnsEvent {
                    id: format!("sched-{}", now_millis()),
                    event_type: "schedule_switch".to_string(),
                    server_name: target.name.clone(),
                    addresses: addresses.clone(),
                    latency_ms: None,
                    success: true,
                    detail: Some(format!("Schedule rule \"{}\" matched", rule.name)),
                    timestamp: now_millis(),
                });

                // 发送调度事件到前端
                let _ = app_handle.emit(
                    "schedule-event",
                    ScheduleEvent {
                        action: "switched".to_string(),
                        rule_name: rule.name.clone(),
                        target_server: target.name.clone(),
                        error: None,
                        timestamp: now_millis(),
                    },
                );

                // 发送系统通知
                send_notification(
                    app_handle,
                    &format!("DNS Switched to {}", target.name),
                    &format!("Schedule rule \"{}\" matched", rule.name),
                );
            }
            Err(e) => {
                log::error!("[schedule] Rule \"{}\" switch failed: {}", rule.name, e.message);
                let _ = app_handle.emit(
                    "schedule-event",
                    ScheduleEvent {
                        action: "error".to_string(),
                        rule_name: rule.name.clone(),
                        target_server: target.name.clone(),
                        error: Some(e.message.clone()),
                        timestamp: now_millis(),
                    },
                );
            }
        }

        // 命中一条规则后即停止（已切换到目标 DNS）
        break;
    }
}

/// 检查调度条件是否匹配当前环境
fn condition_matches(condition: &ScheduleCondition, startup_executed: &AtomicBool) -> bool {
    match condition {
        ScheduleCondition::Time {
            time_range,
            days_of_week,
        } => {
            let now = Local::now();
            let current_minutes = now.hour() * 60 + now.minute();

            let start_parts: Vec<&str> = time_range.start.split(':').collect();
            let end_parts: Vec<&str> = time_range.end.split(':').collect();

            if start_parts.len() != 2 || end_parts.len() != 2 {
                return false;
            }

            let start_minutes = start_parts[0].parse::<u32>().unwrap_or(0) * 60
                + start_parts[1].parse::<u32>().unwrap_or(0);
            let end_minutes = end_parts[0].parse::<u32>().unwrap_or(0) * 60
                + end_parts[1].parse::<u32>().unwrap_or(0);

            // 支持跨天时间范围（如 22:00 - 06:00）
            let in_time_range = if start_minutes <= end_minutes {
                current_minutes >= start_minutes && current_minutes < end_minutes
            } else {
                current_minutes >= start_minutes || current_minutes < end_minutes
            };

            // 星期几匹配（0=周一, 空数组表示每天）
            let weekday = now.weekday().num_days_from_monday();
            let day_matches = days_of_week.is_empty()
                || days_of_week.contains(&weekday);

            in_time_range && day_matches
        }
        ScheduleCondition::Network { ssid, .. } => {
            let current_ssid = system_dns::get_current_ssid();
            if let Some(expected) = ssid {
                current_ssid.as_deref() == Some(expected.as_str())
            } else {
                current_ssid.is_some()
            }
        }
        ScheduleCondition::Cron { expression } => matches_cron(expression),
        // Startup：仅在首次检查时为 true（CAS 从 false 设为 true）
        ScheduleCondition::Startup => !startup_executed.swap(true, Ordering::Relaxed),
        ScheduleCondition::Always => true,
    }
}

/// 简易 Cron 表达式匹配（5 字段：分 时 日 月 周）
fn matches_cron(expression: &str) -> bool {
    let parts: Vec<&str> = expression.split_whitespace().collect();
    if parts.len() != 5 {
        return false;
    }

    let now = Local::now();
    let fields = [
        (now.minute() as i32, parts[0]),
        (now.hour() as i32, parts[1]),
        (now.day() as i32, parts[2]),
        (now.month() as i32, parts[3]),
        // chrono 的 Weekday::num_days_from_sunday: Sun=0, ..., Sat=6
        (now.weekday().num_days_from_sunday() as i32, parts[4]),
    ];

    fields.iter().all(|(value, pattern)| matches_field(*value, pattern))
}

/// 匹配单个 Cron 字段值
/// 支持 *（通配）、*/n（每隔 n）、逗号分隔、范围（a-b）、精确值
fn matches_field(value: i32, pattern: &str) -> bool {
    if pattern == "*" {
        return true;
    }

    // 步进：*/n
    if let Some(rest) = pattern.strip_prefix("*/") {
        if let Ok(n) = rest.parse::<i32>() {
            return n > 0 && value % n == 0;
        }
    }

    // 逗号分隔
    if pattern.contains(',') {
        return pattern.split(',').any(|p| matches_field(value, p));
    }

    // 范围：a-b
    if let Some((start, end)) = pattern.split_once('-') {
        if let (Ok(s), Ok(e)) = (start.parse::<i32>(), end.parse::<i32>()) {
            return value >= s && value <= e;
        }
    }

    // 精确值
    if let Ok(n) = pattern.parse::<i32>() {
        return value == n;
    }

    false
}

fn send_notification(_app_handle: &tauri::AppHandle, title: &str, body: &str) {
    let config = config::load_config().ok();
    if config.map(|c| c.settings.notify_on_switch).unwrap_or(false) {
        let _ = std::process::Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "display notification \"{}\" with title \"{}\"",
                    body, title
                ),
            ])
            .output();
    }
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
