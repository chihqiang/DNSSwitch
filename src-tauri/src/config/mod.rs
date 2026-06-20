// ============================================================
// 配置持久化模块
// 配置文件存储在 ~/.dnsswitch/config.json
// 首次加载时自动创建默认配置
// ============================================================

pub mod types;

use std::fs;
use std::path::PathBuf;

use crate::error::AppError;
use types::AppConfig;

/// 获取配置文件路径：~/.dnsswitch/config.json
fn config_path() -> Result<PathBuf, AppError> {
    let home = std::env::var("HOME")
        .map_err(|_| AppError::new("Cannot determine home directory"))?;
    Ok(PathBuf::from(home).join(".dnsswitch").join("config.json"))
}

/// 加载配置，文件不存在时自动创建默认配置
pub fn load_config() -> Result<AppConfig, AppError> {
    let path = config_path()?;

    if !path.exists() {
        let config = AppConfig::default();
        save_config(&config)?;
        return Ok(config);
    }

    let content = fs::read_to_string(&path)?;
    let config: AppConfig = serde_json::from_str(&content)?;
    Ok(config)
}

/// 保存配置到磁盘（自动创建目录）
pub fn save_config(config: &AppConfig) -> Result<(), AppError> {
    let path = config_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(config)?;
    fs::write(&path, content)?;
    Ok(())
}
