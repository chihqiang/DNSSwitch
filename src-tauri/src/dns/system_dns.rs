// ============================================================
// macOS 系统 DNS 管理
// 通过 scutil / networksetup / osascript 命令管理 DNS 设置
// 需要管理员权限执行 DNS 修改操作
// ============================================================

use std::process::Command;

use crate::error::AppError;
use super::types::DnsStatus;

/// macOS 系统配置命令常量
const CMD_SCUTIL: &str = "scutil";
const CMD_NETWORKSETUP: &str = "networksetup";
const CMD_OSASCRIPT: &str = "osascript";
const ARG_DNS: &str = "--dns";
const ARG_SET_DNS_SERVERS: &str = "-setdnsservers";
const ARG_LIST_ALL_SERVICES: &str = "-listallnetworkservices";
const ARG_GET_INFO: &str = "-getinfo";
const ARG_EMPTY: &str = "empty";
const ARG_E: &str = "-e";

/// scutil 输出解析标记
const PREFIX_RESOLVER: &str = "resolver #";
const PREFIX_NAMESERVER: &str = "nameserver ";
const FILTER_STAR: &str = "*";
const FILTER_DHCP: &str = "DHCP";
const FILTER_MANUAL: &str = "Manual";
const FILTER_IP_ADDRESS: &str = "IP address:";

const ERR_NO_ADDRESSES: &str = "No DNS addresses provided";
const ERR_NO_ACTIVE_SERVICE: &str =
    "No active network service found. Ensure you are connected to a network.";

/// 获取当前系统 DNS 状态
pub fn get_current_dns_status() -> Result<DnsStatus, AppError> {
    let output = Command::new(CMD_SCUTIL)
        .arg(ARG_DNS)
        .output()
        .map_err(|e| AppError::new(format!("Failed to run scutil: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let dns_servers = parse_scutil_dns_output(&stdout);
    let network_service = detect_active_network_service()?;
    let is_custom = !dns_servers.is_empty();

    Ok(DnsStatus {
        current_servers: dns_servers,
        network_service,
        is_custom,
        latency: None,
    })
}

/// 通过 AppleScript 请求管理员权限执行 networksetup 命令
/// 这是修改系统 DNS 所必需的，因为 macOS 需要 sudo 权限
fn run_networksetup_with_privileges(script: &str) -> Result<(), AppError> {
    let osa_script = format!(
        "do shell script \"{}\" with administrator privileges",
        script.replace('"', "\\\"")
    );

    let output = Command::new(CMD_OSASCRIPT)
        .arg(ARG_E)
        .arg(&osa_script)
        .output()
        .map_err(|e| AppError::new(format!("Failed to request privileges: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let msg = stderr.trim();
        if msg.contains("User canceled") || msg.contains("Authorization cancelled") {
            return Err(AppError::new("Operation cancelled by user"));
        }
        return Err(AppError::new(format!("Failed to set DNS: {}", msg)));
    }

    Ok(())
}

/// 切换到指定的 DNS 服务器地址列表
pub fn switch_to_dns(_server_id: &str, addresses: &[String]) -> Result<(), AppError> {
    let service_name = detect_active_network_service()?;

    if addresses.is_empty() {
        return Err(AppError::new(ERR_NO_ADDRESSES));
    }

    let escaped_service = service_name.replace('"', "\\\"");
    let addr_str = addresses
        .iter()
        .map(|a| a.trim())
        .collect::<Vec<_>>()
        .join(" ");

    let script = format!(
        "{} {} \"{}\" {}",
        CMD_NETWORKSETUP, ARG_SET_DNS_SERVERS, escaped_service, addr_str
    );

    run_networksetup_with_privileges(&script)
}

/// 恢复系统默认 DNS（清空自定义 DNS 设置）
pub fn reset_to_system_dns() -> Result<(), AppError> {
    let service_name = detect_active_network_service()?;
    let escaped_service = service_name.replace('"', "\\\"");

    let script = format!(
        "{} {} \"{}\" {}",
        CMD_NETWORKSETUP, ARG_SET_DNS_SERVERS, escaped_service, ARG_EMPTY
    );

    run_networksetup_with_privileges(&script)
}

/// 检测当前活跃的网络服务（如 Wi-Fi、以太网）
/// 遍历所有网络服务，找到有 IP 地址且为 DHCP/Manual 配置的服务
fn detect_active_network_service() -> Result<String, AppError> {
    let output = Command::new(CMD_NETWORKSETUP)
        .arg(ARG_LIST_ALL_SERVICES)
        .output()
        .map_err(|e| AppError::new(format!("Failed to list network services: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines().skip(1) {
        let service = line.trim();
        if service.is_empty() || service.starts_with(FILTER_STAR) {
            continue;
        }

        let status = Command::new(CMD_NETWORKSETUP)
            .arg(ARG_GET_INFO)
            .arg(service)
            .output();

        if let Ok(status) = status {
            let info = String::from_utf8_lossy(&status.stdout);
            if (info.contains(FILTER_DHCP) || info.contains(FILTER_MANUAL))
                && info.contains(FILTER_IP_ADDRESS)
            {
                return Ok(service.to_string());
            }
        }
    }

    Err(AppError::new(ERR_NO_ACTIVE_SERVICE))
}

/// 获取当前 Wi-Fi SSID（通过 airport 命令）
pub fn get_current_ssid() -> Option<String> {
    let output = std::process::Command::new(
        "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
    )
    .arg("-I")
    .output()
    .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let trimmed = line.trim();
        if let Some(ssid) = trimmed.strip_prefix("SSID: ") {
            let s = ssid.trim().to_string();
            if !s.is_empty() && s != "(null)" && s != "N/A" {
                return Some(s);
            }
        }
    }

    None
}

/// 解析 scutil --dns 输出，提取 nameserver 地址列表
fn parse_scutil_dns_output(output: &str) -> Vec<String> {
    let mut servers = Vec::new();
    let mut in_resolver = false;

    for line in output.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with(PREFIX_RESOLVER) {
            in_resolver = true;
            continue;
        }

        if in_resolver && trimmed.starts_with(PREFIX_NAMESERVER) {
            if let Some(addr) = trimmed.strip_prefix(PREFIX_NAMESERVER) {
                let addr = addr.trim();
                // IPv6 地址会用 [] 包裹，我们只提取 IPv4
                if !addr.is_empty() && !addr.starts_with('[') {
                    servers.push(addr.to_string());
                }
            }
        }
    }

    servers
}
