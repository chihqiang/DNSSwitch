// DNS 提供商注册表 — 管理提供商元数据和预设/自定义服务器定义
// 数据存储在 ~/.dnsswitch/dnsprovider.json，首次启动自动初始化默认数据

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::config;
use crate::error::AppError;

// ---- 数据结构 ----

/// 提供商元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderInfo {
    pub key: String,
    pub name: String,
    pub display_name: String,
    pub website: Option<String>,
    pub description: Option<String>,
}

/// 预设/自定义服务器定义（不含运行时状态如 isActive、latency）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerDef {
    pub id: String,
    pub name: String,
    pub provider_key: String,
    pub addresses: Vec<String>,
    pub tags: Vec<String>,
    pub doh_url: Option<String>,
    pub dot_address: Option<String>,
}

/// 提供商注册表
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRegistry {
    pub providers: Vec<ProviderInfo>,
    pub servers: Vec<ServerDef>,
}

// ---- 文件路径 ----

fn registry_path() -> Result<PathBuf, AppError> {
    Ok(config::data_dir()?.join("dnsprovider.json"))
}

// ---- 加载/保存 ----

/// 加载注册表，文件不存在时自动创建默认数据
pub fn load_registry() -> Result<ProviderRegistry, AppError> {
    let path = registry_path()?;
    if !path.exists() {
        let registry = default_registry();
        save_registry(&registry)?;
        log::info!("[provider] Initialized default provider registry with {} providers, {} servers", registry.providers.len(), registry.servers.len());
        return Ok(registry);
    }
    let content = fs::read_to_string(&path)
        .inspect_err(|e| log::error!("[provider] Failed to read registry: {}", e))?;
    let registry: ProviderRegistry = serde_json::from_str(&content)
        .inspect_err(|e| log::error!("[provider] Failed to parse registry: {}", e))?;
    Ok(registry)
}

fn save_registry(registry: &ProviderRegistry) -> Result<(), AppError> {
    let path = registry_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let content = serde_json::to_string_pretty(registry)?;
    fs::write(&path, content)
        .inspect_err(|e| log::error!("[provider] Failed to save registry: {}", e))?;
    Ok(())
}

// ---- 默认数据（从 TypeScript 翻译） ----

fn default_registry() -> ProviderRegistry {
    ProviderRegistry {
        providers: vec![
            ProviderInfo { key: "system".into(), name: "system".into(), display_name: "System Default".into(), website: None, description: Some("Use system default DNS".into()) },
            ProviderInfo { key: "cloudflare".into(), name: "cloudflare".into(), display_name: "Cloudflare".into(), website: Some("https://1.1.1.1".into()), description: Some("1.1.1.1 - Privacy-first DNS".into()) },
            ProviderInfo { key: "cloudflare_family".into(), name: "cloudflare_family".into(), display_name: "Cloudflare Family".into(), website: Some("https://1.1.1.1/family".into()), description: Some("1.1.1.2 - Malware blocking".into()) },
            ProviderInfo { key: "google".into(), name: "google".into(), display_name: "Google DNS".into(), website: Some("https://dns.google".into()), description: Some("8.8.8.8 - Reliable public DNS".into()) },
            ProviderInfo { key: "quad9".into(), name: "quad9".into(), display_name: "Quad9".into(), website: Some("https://quad9.net".into()), description: Some("9.9.9.9 - Security-focused DNS".into()) },
            ProviderInfo { key: "opendns".into(), name: "opendns".into(), display_name: "OpenDNS".into(), website: Some("https://opendns.com".into()), description: Some("208.67.222.222 - Family-friendly DNS".into()) },
            ProviderInfo { key: "adguard".into(), name: "adguard".into(), display_name: "AdGuard DNS".into(), website: Some("https://adguard.com/adguard-dns/overview.html".into()), description: Some("94.140.14.14 - Ad-blocking DNS".into()) },
            ProviderInfo { key: "nextdns".into(), name: "nextdns".into(), display_name: "NextDNS".into(), website: Some("https://nextdns.io".into()), description: Some("45.90.28.28 - Privacy-focused DNS".into()) },
            ProviderInfo { key: "comodosecure".into(), name: "comodosecure".into(), display_name: "Comodo Secure".into(), website: Some("https://www.comodo.com/secure-dns".into()), description: Some("8.26.56.26 - Security-focused DNS".into()) },
            ProviderInfo { key: "dnswatch".into(), name: "dnswatch".into(), display_name: "DNS.WATCH".into(), website: Some("https://dns.watch".into()), description: Some("84.200.69.80 - Privacy-focused DNS".into()) },
            ProviderInfo { key: "cleanbrowsing".into(), name: "cleanbrowsing".into(), display_name: "CleanBrowsing".into(), website: Some("https://cleanbrowsing.org".into()), description: Some("185.228.168.168 - Family-safe DNS".into()) },
            ProviderInfo { key: "alidns".into(), name: "alidns".into(), display_name: "AliDNS".into(), website: Some("https://www.alidns.com".into()), description: Some("223.5.5.5 - Fast DNS in Asia".into()) },
            ProviderInfo { key: "dnspod".into(), name: "dnspod".into(), display_name: "DNSPod".into(), website: Some("https://www.dnspod.cn".into()), description: Some("119.29.29.29 - Fast DNS in China".into()) },
            ProviderInfo { key: "custom".into(), name: "custom".into(), display_name: "Custom".into(), website: None, description: Some("Custom DNS server".into()) },
        ],
        servers: vec![
            ServerDef { id: "cloudflare".into(), name: "Cloudflare".into(), provider_key: "cloudflare".into(), addresses: vec!["1.1.1.1".into(), "1.0.0.1".into()], tags: vec!["public".into(), "privacy".into()], doh_url: Some("https://dns.cloudflare.com/dns-query".into()), dot_address: Some("1.1.1.1".into()) },
            ServerDef { id: "cloudflare_family".into(), name: "Cloudflare Family".into(), provider_key: "cloudflare_family".into(), addresses: vec!["1.1.1.2".into(), "1.0.0.2".into()], tags: vec!["family".into(), "security".into()], doh_url: Some("https://dns.cloudflare.com/dns-query".into()), dot_address: Some("1.1.1.2".into()) },
            ServerDef { id: "google".into(), name: "Google DNS".into(), provider_key: "google".into(), addresses: vec!["8.8.8.8".into(), "8.8.4.4".into()], tags: vec!["public".into(), "fast".into()], doh_url: Some("https://dns.google/dns-query".into()), dot_address: Some("8.8.8.8".into()) },
            ServerDef { id: "quad9".into(), name: "Quad9".into(), provider_key: "quad9".into(), addresses: vec!["9.9.9.9".into(), "149.112.112.112".into()], tags: vec!["public".into(), "security".into()], doh_url: Some("https://dns.quad9.net/dns-query".into()), dot_address: Some("9.9.9.9".into()) },
            ServerDef { id: "opendns".into(), name: "OpenDNS".into(), provider_key: "opendns".into(), addresses: vec!["208.67.222.222".into(), "208.67.220.220".into()], tags: vec!["public".into(), "family".into()], doh_url: None, dot_address: None },
            ServerDef { id: "adguard".into(), name: "AdGuard DNS".into(), provider_key: "adguard".into(), addresses: vec!["94.140.14.14".into(), "94.140.15.15".into()], tags: vec!["public".into(), "privacy".into()], doh_url: Some("https://dns.adguard.com/dns-query".into()), dot_address: Some("94.140.14.14".into()) },
            ServerDef { id: "nextdns".into(), name: "NextDNS".into(), provider_key: "nextdns".into(), addresses: vec!["45.90.28.28".into(), "45.90.30.28".into()], tags: vec!["privacy".into(), "security".into()], doh_url: Some("https://dns.nextdns.io/dns-query".into()), dot_address: Some("45.90.28.28".into()) },
            ServerDef { id: "comodosecure".into(), name: "Comodo Secure".into(), provider_key: "comodosecure".into(), addresses: vec!["8.26.56.26".into(), "8.20.247.20".into()], tags: vec!["security".into()], doh_url: None, dot_address: None },
            ServerDef { id: "dnswatch".into(), name: "DNS.WATCH".into(), provider_key: "dnswatch".into(), addresses: vec!["84.200.69.80".into(), "84.200.70.40".into()], tags: vec!["privacy".into()], doh_url: None, dot_address: None },
            ServerDef { id: "cleanbrowsing".into(), name: "CleanBrowsing".into(), provider_key: "cleanbrowsing".into(), addresses: vec!["185.228.168.168".into(), "185.228.169.168".into()], tags: vec!["family".into(), "security".into()], doh_url: Some("https://dns.cleanbrowsing.org/dns-query".into()), dot_address: None },
            ServerDef { id: "alidns".into(), name: "AliDNS".into(), provider_key: "alidns".into(), addresses: vec!["223.5.5.5".into(), "223.6.6.6".into()], tags: vec!["fast".into(), "public".into()], doh_url: None, dot_address: None },
            ServerDef { id: "dnspod".into(), name: "DNSPod".into(), provider_key: "dnspod".into(), addresses: vec!["119.29.29.29".into(), "119.28.28.28".into()], tags: vec!["fast".into(), "public".into()], doh_url: None, dot_address: None },
        ],
    }
}

// ---- Tauri 命令 ----

/// 获取完整的提供商注册表（提供商元数据 + 服务器定义）
#[tauri::command(rename_all = "camelCase")]
pub fn get_provider_registry() -> Result<ProviderRegistry, String> {
    load_registry().map_err(|e| e.message)
}

/// 向注册表添加自定义服务器定义
#[tauri::command(rename_all = "camelCase")]
pub fn add_server_to_registry(server: ServerDef) -> Result<(), String> {
    let mut registry = load_registry().map_err(|e| e.message)?;
    registry.servers.push(server);
    save_registry(&registry).map_err(|e| e.message)?;
    log::info!("[provider] Added server '{}' to registry", registry.servers.last().map(|s| s.name.as_str()).unwrap_or("?"));
    Ok(())
}

/// 更新注册表中的服务器定义
#[tauri::command(rename_all = "camelCase")]
pub fn update_server_in_registry(id: String, updates: ServerDef) -> Result<(), String> {
    let mut registry = load_registry().map_err(|e| e.message)?;
    if let Some(s) = registry.servers.iter_mut().find(|s| s.id == id) {
        *s = updates;
        save_registry(&registry).map_err(|e| e.message)?;
        log::info!("[provider] Updated server '{}' in registry", id);
    }
    Ok(())
}

/// 从注册表删除服务器定义
#[tauri::command(rename_all = "camelCase")]
pub fn delete_server_from_registry(id: String) -> Result<(), String> {
    let mut registry = load_registry().map_err(|e| e.message)?;
    registry.servers.retain(|s| s.id != id);
    save_registry(&registry).map_err(|e| e.message)?;
    log::info!("[provider] Deleted server '{}' from registry", id);
    Ok(())
}

/// 重置注册表为默认状态（恢复所有预设服务器和提供商信息）
#[tauri::command(rename_all = "camelCase")]
pub fn reset_provider_registry() -> Result<ProviderRegistry, String> {
    let registry = default_registry();
    save_registry(&registry).map_err(|e| e.message)?;
    log::info!("[provider] Registry reset to defaults");
    Ok(registry)
}
