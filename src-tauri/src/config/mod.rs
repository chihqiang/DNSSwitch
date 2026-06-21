// ============================================================
// 配置持久化模块
// 配置文件存储在 ~/.dnsswitch/config.json
// 首次加载时自动创建默认配置
// 使用内存缓存减少磁盘读取
// ============================================================

pub mod types;

use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

use directories::BaseDirs;

use crate::error::AppError;
use types::{AppConfig, DATA_DIR};

/// 内存缓存，避免 monitor 线程频繁读磁盘
static CACHED_CONFIG: RwLock<Option<AppConfig>> = RwLock::new(None);

/// 获取应用数据目录路径：
/// macOS/Linux: ~/.dnsswitch
/// Windows: %USERPROFILE%\.dnsswitch
pub fn data_dir() -> Result<PathBuf, AppError> {
    let base = BaseDirs::new().ok_or_else(|| AppError::new("Cannot find home directory"))?;
    Ok(base.home_dir().join(DATA_DIR))
}

/// 获取配置文件路径：~/.dnsswitch/config.json
fn config_path() -> Result<PathBuf, AppError> {
    Ok(data_dir()?.join("config.json"))
}

/// 加载配置（优先从缓存读取），文件不存在时自动创建默认配置
pub fn load_config() -> Result<AppConfig, AppError> {
    // 优先命中缓存
    if let Some(ref config) = *CACHED_CONFIG.read().unwrap() {
        return Ok(config.clone());
    }

    let path = config_path()?;

    if !path.exists() {
        let config = AppConfig::default();
        save_config(&config)?;
        *CACHED_CONFIG.write().unwrap() = Some(config.clone());
        return Ok(config);
    }

    let content = fs::read_to_string(&path)?;
    let config: AppConfig = serde_json::from_str(&content)?;
    *CACHED_CONFIG.write().unwrap() = Some(config.clone());
    Ok(config)
}

/// 保存配置到磁盘并更新缓存
pub fn save_config(config: &AppConfig) -> Result<(), AppError> {
    let path = config_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(config)?;
    fs::write(&path, content)
        .inspect_err(|e| log::error!("[config] Failed to save config: {}", e))?;

    // 更新缓存
    *CACHED_CONFIG.write().unwrap() = Some(config.clone());
    Ok(())
}
