pub mod types;

use std::fs;
use std::path::PathBuf;

use crate::error::AppError;
use types::AppConfig;

fn config_path() -> Result<PathBuf, AppError> {
    let home = std::env::var("HOME")
        .map_err(|_| AppError::new("Cannot determine home directory"))?;
    Ok(PathBuf::from(home).join(".dnsswitch").join("config.json"))
}

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

pub fn save_config(config: &AppConfig) -> Result<(), AppError> {
    let path = config_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(config)?;
    fs::write(&path, content)?;
    Ok(())
}
