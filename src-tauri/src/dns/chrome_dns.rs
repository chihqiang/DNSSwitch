// ============================================================
// Chrome DNS-over-HTTPS 策略管理（macOS）
// Chrome 的 DoH 设置存储在 Local State JSON 文件的 dns_over_https 键中
// Chrome 运行时也会写这个文件，所以必须先退出 Chrome 再修改
// ============================================================

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde_json;

use crate::error::AppError;

/// Chrome Local State 候选路径（稳定版 / Beta / Canary）
const CHROME_PROFILES: &[&str] = &[
    "Google/Chrome",
    "Google/Chrome Beta",
    "Google/Chrome Canary",
];

/// 检查 Chrome 是否已安装
pub fn is_chrome_installed() -> bool {
    chrome_local_state_path().is_some()
}

/// 查找 Chrome Local State 路径
fn chrome_local_state_path() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let base = PathBuf::from(home).join("Library/Application Support");
    for profile in CHROME_PROFILES {
        let path = base.join(profile).join("Local State");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// 检查 Chrome 是否正在运行
fn is_chrome_running() -> bool {
    Command::new("pgrep")
        .args(["-q", "-f", "Google Chrome"])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 退出 Chrome
fn quit_chrome() -> Result<(), AppError> {
    log::info!("[chrome] Quitting Chrome...");
    let output = Command::new("osascript")
        .args(["-e", "tell application \"Google Chrome\" to quit"])
        .output()
        .map_err(|e| AppError::new(format!("Failed to quit Chrome: {}", e)))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        // Chrome 可能本来就没在运行，不算错
        if err.contains("(-1728)") || err.contains("not running") {
            return Ok(());
        }
        return Err(AppError::new(format!("Failed to quit Chrome: {}", err.trim())));
    }

    // 等 Chrome 完全退出（最多等 5 秒）
    for _ in 0..50 {
        if !is_chrome_running() {
            log::info!("[chrome] Chrome quit successfully");
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }

    Err(AppError::new("Chrome did not quit in time, please close it manually"))
}

/// 为 Chrome 设置 DoH
pub fn set_chrome_doh(doh_url: &str) -> Result<(), AppError> {
    let local_state = chrome_local_state_path()
        .ok_or_else(|| AppError::new("Chrome is not installed"))?;

    if doh_url.is_empty() {
        return Err(AppError::new("No DoH URL provided"));
    }

    // 先退出 Chrome，否则它会把我们的修改覆盖掉
    if is_chrome_running() {
        quit_chrome()?;
    }

    log::info!("[chrome] Setting Chrome DoH: {} → {:?}", doh_url, local_state);

    let content = fs::read_to_string(&local_state)
        .map_err(|e| AppError::new(format!("Failed to read Chrome Local State: {}", e)))?;

    let mut root: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| AppError::new(format!("Failed to parse Chrome Local State JSON: {}", e)))?;

    let doh_obj = serde_json::json!({
        "mode": "secure",
        "templates": doh_url,
    });

    if let Some(obj) = root.as_object_mut() {
        obj.insert("dns_over_https".to_string(), doh_obj);
    }

    let new_content = serde_json::to_string_pretty(&root)
        .map_err(|e| AppError::new(format!("Failed to serialize Local State JSON: {}", e)))?;

    fs::write(&local_state, new_content)
        .map_err(|e| AppError::new(format!("Failed to write Chrome Local State: {}", e)))?;

    log::info!("[chrome] Chrome DoH configured — restart Chrome to apply");
    Ok(())
}

/// 清除 Chrome 的 DoH 设置
pub fn reset_chrome_doh() -> Result<(), AppError> {
    let local_state = match chrome_local_state_path() {
        Some(p) => p,
        None => return Ok(()),
    };

    if is_chrome_running() {
        let _ = quit_chrome();
    }

    log::info!("[chrome] Resetting Chrome DoH: {:?}", local_state);

    let content = match fs::read_to_string(&local_state) {
        Ok(c) => c,
        Err(e) => {
            log::warn!("[chrome] Failed to read Local State: {}", e);
            return Ok(());
        }
    };

    let mut root: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            log::warn!("[chrome] Failed to parse Local State JSON: {}", e);
            return Ok(());
        }
    };

    if let Some(obj) = root.as_object_mut() {
        obj.insert(
            "dns_over_https".to_string(),
            serde_json::json!({"mode": "automatic"}),
        );
    }

    let new_content = serde_json::to_string_pretty(&root)
        .map_err(|e| AppError::new(format!("Failed to serialize Local State JSON: {}", e)))?;

    fs::write(&local_state, new_content)
        .map_err(|e| AppError::new(format!("Failed to write Chrome Local State: {}", e)))?;

    log::info!("[chrome] Chrome DoH reset complete");
    Ok(())
}

/// 获取 Chrome 当前的 DoH 设置
pub fn get_chrome_doh() -> Result<Option<String>, AppError> {
    let local_state = match chrome_local_state_path() {
        Some(p) => p,
        None => return Ok(None),
    };

    let content = match fs::read_to_string(&local_state) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let root: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };

    let doh = match root.get("dns_over_https") {
        Some(v) => v,
        None => return Ok(None),
    };

    let mode = match doh.get("mode").and_then(|m| m.as_str()) {
        Some(m) => m,
        None => return Ok(None),
    };

    if mode == "secure" {
        Ok(doh.get("templates")
            .and_then(|t| t.as_str())
            .filter(|u| !u.is_empty())
            .map(|u| u.to_string()))
    } else {
        Ok(None)
    }
}
