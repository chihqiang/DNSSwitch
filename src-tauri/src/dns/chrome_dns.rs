// ============================================================
// Chrome DNS-over-HTTPS 跨平台配置管理
// 支持 Windows, macOS, Linux
// ============================================================

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use directories::BaseDirs;
use serde_json;

use crate::error::AppError;

/// Chrome Local State 候选路径（稳定版 / Beta / Canary）
const CHROME_PROFILES: &[&str] = &[
    "Google/Chrome",
    "Google/Chrome Beta",
    "Google/Chrome Canary",
];

/// 跨平台获取 Chrome Local State 路径
fn chrome_local_state_path() -> Option<PathBuf> {
    let base_dirs = BaseDirs::new()?;
    let base = base_dirs.data_dir(); // 自动处理 Win/Mac/Linux 路径

    for profile in CHROME_PROFILES {
        let path = base.join(profile).join("Local State");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// 检查 Chrome 是否已安装
pub fn is_chrome_installed() -> bool {
    chrome_local_state_path().is_some()
}

/// 检查 Chrome 是否正在运行（跨平台）
fn is_chrome_running() -> bool {
    let output = if cfg!(target_os = "windows") {
        Command::new("tasklist")
            .args(["/FI", "IMAGENAME eq chrome.exe"])
            .output()
    } else {
        Command::new("pgrep")
            .args(["-q", "-f", "Google Chrome"])
            .output()
    };

    output.map(|o| o.status.success()).unwrap_or(false)
}

/// 优雅退出 Chrome（跨平台）
fn quit_chrome() -> Result<(), AppError> {
    log::info!("[chrome] Quitting Chrome...");
    
    let output = if cfg!(target_os = "windows") {
        Command::new("taskkill")
            .args(["/F", "/IM", "chrome.exe"])
            .output()
    } else if cfg!(target_os = "macos") {
        Command::new("osascript")
            .args(["-e", "tell application \"Google Chrome\" to quit"])
            .output()
    } else {
        Command::new("pkill")
            .args(["-f", "chrome"])
            .output()
    };

    match output {
        Ok(o) if !o.status.success() => {
            let err = String::from_utf8_lossy(&o.stderr);
            if err.contains("(-1728)") || err.contains("not running") || err.contains("No matching processes") {
                return Ok(()); // 没运行不算错
            }
            Err(AppError::new(format!("Failed to quit Chrome: {}", err.trim())))
        }
        Err(e) => Err(AppError::new(format!("Failed to execute quit command: {}", e))),
        _ => {
            // 等待进程完全释放文件锁
            for _ in 0..50 {
                if !is_chrome_running() {
                    log::info!("[chrome] Chrome quit successfully");
                    return Ok(());
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(AppError::new("Chrome did not quit in time, please close it manually"))
        }
    }
}

/// 为 Chrome 设置 DoH（直接修改 Local State 文件）
pub fn set_chrome_doh(doh_url: &str) -> Result<(), AppError> {
    let local_state = chrome_local_state_path()
        .ok_or_else(|| AppError::new("Chrome is not installed"))?;

    if doh_url.is_empty() {
        return Err(AppError::new("No DoH URL provided"));
    }

    if is_chrome_running() {
        quit_chrome()?;
    }

    log::info!("[chrome] Setting Chrome DoH: {} → {:?}", doh_url, local_state);

    let content = fs::read_to_string(&local_state)
        .map_err(|e| AppError::new(format!("Failed to read Chrome Local State: {}", e)))?;

    let mut root: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| AppError::new(format!("Failed to parse Local State JSON: {}", e)))?;

    let doh_obj = serde_json::json!({
        "mode": "secure",
        "templates": doh_url,
    });

    if let Some(obj) = root.as_object_mut() {
        obj.insert("dns_over_https".to_string(), doh_obj);
    }

    // 使用紧凑格式序列化，保持与 Chrome 原生格式一致
    let new_content = serde_json::to_string(&root)
        .map_err(|e| AppError::new(format!("Failed to serialize Local State JSON: {}", e)))?;

    fs::write(&local_state, new_content)
        .map_err(|e| AppError::new(format!("Failed to write Local State: {}", e)))?;

    log::info!("[chrome] Chrome DoH configured — restart Chrome to apply");
    Ok(())
}

/// 彻底清除 Chrome 的 DoH 设置
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
        // 彻底移除该键，让 Chrome 恢复默认状态
        obj.remove("dns_over_https");
    }

    let new_content = serde_json::to_string(&root)
        .map_err(|e| AppError::new(format!("Failed to serialize Local State JSON: {}", e)))?;

    fs::write(&local_state, new_content)
        .map_err(|e| AppError::new(format!("Failed to write Local State: {}", e)))?;

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