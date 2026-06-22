use std::fs;
use std::io::{BufRead, BufReader};

use serde::{Deserialize, Serialize};

/// 前端日志 IPC 桥接
#[tauri::command]
pub fn log_message(level: String, message: String) {
    match level.to_lowercase().as_str() {
        "error" => log::error!("[frontend] {message}"),
        "warn" => log::warn!("[frontend] {message}"),
        "info" => log::info!("[frontend] {message}"),
        "debug" => log::debug!("[frontend] {message}"),
        "trace" => log::trace!("[frontend] {message}"),
        _ => log::info!("[frontend] {message}"),
    }
}

/// 日志文件中的一行
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub timestamp: String,
    pub level: String,
    pub tag: String,
    pub message: String,
    pub raw: String,
}

/// 读取今日日志文件，返回最近 N 行（默认 20）
#[tauri::command(rename_all = "camelCase")]
pub fn read_log_file(limit: Option<usize>) -> Result<Vec<LogLine>, String> {
    let path = today_log_path()?;

    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let limit = limit.unwrap_or(20);

    let mut lines: Vec<LogLine> = Vec::new();
    for line in reader.lines() {
        let raw = line.map_err(|e| e.to_string())?;
        lines.push(parse_log_line(&raw));
    }

    // 保留最后 N 行，反转（最新的在最前）
    if lines.len() > limit {
        lines = lines.split_off(lines.len() - limit);
    }
    lines.reverse();

    Ok(lines)
}

/// 清空今日日志文件
#[tauri::command(rename_all = "camelCase")]
pub fn clear_log_file() -> Result<(), String> {
    let path = today_log_path()?;
    fs::write(&path, "").map_err(|e| e.to_string())?;
    log::info!("[logger] Log file cleared");
    Ok(())
}

/// 清空所有日志文件（删除 log 目录下所有 .log 文件）
#[tauri::command(rename_all = "camelCase")]
pub fn clear_all_logs() -> Result<(), String> {
    let log_dir = crate::config::data_dir()
        .map_err(|e| e.message)?
        .join("log");
    if !log_dir.exists() {
        return Ok(());
    }
    let count = std::fs::read_dir(&log_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "log"))
        .filter_map(|e| std::fs::remove_file(e.path()).ok())
        .count();
    log::info!("[logger] Cleared {} log files from {:?}", count, log_dir);
    Ok(())
}

fn today_log_path() -> Result<std::path::PathBuf, String> {
    let log_dir = crate::config::data_dir()
        .map_err(|e| e.message)?
        .join("log");
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    Ok(log_dir.join(format!("{}.log", today)))
}

/// 解析日志行：`2026-06-22 10:30:45.123 [LEVEL] [tag] message`
fn parse_log_line(raw: &str) -> LogLine {
    // 时间戳固定 23 字符 "YYYY-MM-DD HH:MM:SS.mmm"
    let timestamp = if raw.len() >= 23 {
        raw[..23].to_string()
    } else {
        String::new()
    };

    let after_ts = if raw.len() > 23 { raw[23..].trim_start() } else { raw };

    // 提取 [LEVEL]
    if let Some(rest) = after_ts.strip_prefix('[') {
        if let Some(end) = rest.find(']') {
            let level = rest[..end].to_string();
            let after_level = rest[end + 1..].trim_start();
            // 提取 [tag]
            if let Some(rest2) = after_level.strip_prefix('[') {
                if let Some(end2) = rest2.find(']') {
                    let tag = rest2[..end2].to_string();
                    let message = rest2[end2 + 1..].trim_start().to_string();
                    return LogLine { timestamp, level, tag, message, raw: raw.to_string() };
                }
            }
            return LogLine {
                timestamp,
                level,
                tag: String::new(),
                message: after_level.to_string(),
                raw: raw.to_string(),
            };
        }
    }

    LogLine {
        timestamp,
        level: String::new(),
        tag: String::new(),
        message: raw.to_string(),
        raw: raw.to_string(),
    }
}
