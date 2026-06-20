// ============================================================
// 系统信息相关 Tauri 命令
// 提供系统信息查询和网络服务列表获取
// ============================================================

use serde::Serialize;

/// macOS 系统命令常量
const CMD_NETWORKSETUP: &str = "networksetup";
const CMD_HOSTNAME: &str = "hostname";
const CMD_SW_VERS: &str = "sw_vers";
const CMD_UNAME: &str = "uname";
const ARG_LIST_ALL_SERVICES: &str = "-listallnetworkservices";
const ARG_GET_DNS_SERVERS: &str = "-getdnsservers";
const ARG_PRODUCT_VERSION: &str = "-productVersion";
const ARG_KERNEL_RELEASE: &str = "-r";

/// 输出过滤关键字
const FILTER_STAR: &str = "*";
const FILTER_EMPTY: &str = "empty";
const FILTER_NO_DNS: &str = "there aren't";
const UNKNOWN: &str = "unknown";

/// 系统信息（OS、版本、主机名、内核）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub hostname: String,
    pub kernel_version: String,
}

/// 网络服务信息（如 Wi-Fi、以太网）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkService {
    pub name: String,
    pub display_name: String,
    pub is_active: bool,
    pub dns_servers: Vec<String>,
}

/// 获取系统基本信息
#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let os = std::env::consts::OS.to_string();
    let hostname = get_hostname().map_err(|e| format!("Failed to get hostname: {}", e))?;
    let os_version = get_os_version();
    let kernel_version = get_kernel_version();

    Ok(SystemInfo {
        os,
        os_version,
        hostname,
        kernel_version,
    })
}

/// 获取所有网络服务及其 DNS 配置
#[tauri::command]
pub fn get_network_services() -> Result<Vec<NetworkService>, String> {
    let output = std::process::Command::new(CMD_NETWORKSETUP)
        .arg(ARG_LIST_ALL_SERVICES)
        .output()
        .map_err(|e| format!("Failed to list network services: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut services = Vec::new();

    for line in stdout.lines().skip(1) {
        let name = line.trim().to_string();
        if name.is_empty() || name.starts_with(FILTER_STAR) {
            continue;
        }

        let dns = get_service_dns(&name);
        services.push(NetworkService {
            display_name: name.clone(),
            is_active: !dns.is_empty(),
            name,
            dns_servers: dns,
        });
    }

    Ok(services)
}

fn get_hostname() -> Result<String, std::io::Error> {
    let output = std::process::Command::new(CMD_HOSTNAME).output()?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn get_os_version() -> String {
    let output = std::process::Command::new(CMD_SW_VERS)
        .arg(ARG_PRODUCT_VERSION)
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Err(_) => UNKNOWN.to_string(),
    }
}

fn get_kernel_version() -> String {
    let output = std::process::Command::new(CMD_UNAME).arg(ARG_KERNEL_RELEASE).output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Err(_) => UNKNOWN.to_string(),
    }
}

/// 获取指定网络服务配置的 DNS 服务器地址列表
fn get_service_dns(service_name: &str) -> Vec<String> {
    let output = std::process::Command::new(CMD_NETWORKSETUP)
        .arg(ARG_GET_DNS_SERVERS)
        .arg(service_name)
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout
                .lines()
                .filter(|l| {
                    !l.is_empty()
                        && !l.contains(FILTER_EMPTY)
                        && !l.contains(FILTER_NO_DNS)
                })
                .map(|l| l.trim().to_string())
                .collect()
        }
        Err(_) => Vec::new(),
    }
}
