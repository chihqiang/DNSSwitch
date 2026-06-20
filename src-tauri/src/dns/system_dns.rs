// ============================================================
// macOS 系统 DNS 管理
// 通过 networksetup / osascript 命令管理 DNS 设置
// 需要管理员权限执行 DNS 修改操作
// ============================================================

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::AppError;
use super::types::DnsStatus;

const CMD_NETWORKSETUP: &str = "networksetup";
const CMD_OSASCRIPT: &str = "osascript";
const ARG_SET_DNS_SERVERS: &str = "-setdnsservers";
const ARG_GET_DNS_SERVERS: &str = "-getdnsservers";
const ARG_LIST_ALL_SERVICES: &str = "-listallnetworkservices";
const ARG_LIST_HARDWARE_PORTS: &str = "-listallhardwareports";
const ARG_GET_INFO: &str = "-getinfo";
const ARG_EMPTY: &str = "empty";
const ARG_E: &str = "-e";

const FILTER_DHCP: &str = "DHCP";
const FILTER_MANUAL: &str = "Manual";
const FILTER_IP_ADDRESS: &str = "IP address:";

const ERR_NO_ADDRESSES: &str = "No DNS addresses provided";
const ERR_NO_ACTIVE_SERVICE: &str =
    "No active network service found. Ensure you are connected to a network.";
const DNS_SWITCH_TIMEOUT_SECS: u64 = 30;

/// 通过默认路由获取当前活跃的网络设备，然后映射到 networksetup 的服务名
/// 步骤：1. route -n get default → 拿到 interface 名称 (如 en0)
///       2. networksetup -listallhardwareports → 建立 device→service 映射
///       3. 用 device 查到对应的 service name
fn detect_active_network_service() -> Result<String, AppError> {
    // 1. 获取默认路由对应的网络接口设备名
    let route_output = Command::new("route")
        .args(["-n", "get", "default"])
        .output()
        .map_err(|e| AppError::new(format!("Failed to run route: {}", e)))?;

    let route_stdout = String::from_utf8_lossy(&route_output.stdout);
    let device = route_stdout
        .lines()
        .find_map(|line| {
            let trimmed = line.trim();
            trimmed.strip_prefix("interface:").map(|s| s.trim().to_string())
        })
        .ok_or_else(|| {
            log::error!("[dns] Could not determine default interface from route output");
            AppError::new(ERR_NO_ACTIVE_SERVICE)
        })?;

    log::info!("[dns] Default route interface: {}", device);

    // 2. 获取硬件端口→服务名映射
    let ports_output = Command::new(CMD_NETWORKSETUP)
        .arg(ARG_LIST_HARDWARE_PORTS)
        .output()
        .map_err(|e| AppError::new(format!("Failed to list hardware ports: {}", e)))?;

    let ports_stdout = String::from_utf8_lossy(&ports_output.stdout);
    // 输出格式：
    // Hardware Port: Wi-Fi
    // Device: en0
    // Hardware Port: USB 10/100/1000 LAN
    // Device: en7
    let mut current_hardware_port: Option<String> = None;
    for line in ports_stdout.lines() {
        let trimmed = line.trim();
        if let Some(port) = trimmed.strip_prefix("Hardware Port: ") {
            current_hardware_port = Some(port.trim().to_string());
        } else if let Some(dev) = trimmed.strip_prefix("Device: ") {
            if dev.trim() == device {
                if let Some(service) = current_hardware_port.take() {
                    log::info!("[dns] Resolved interface {} → service \"{}\"", device, service);
                    return Ok(service);
                }
            }
        }
    }

    // 3. 回退：遍历所有服务找有 IP 的
    log::warn!("[dns] Could not map device {} to service, falling back to service scan", device);
    fallback_detect_active_service()
}

/// 回退方案：遍历所有网络服务，返回第一个有 IP 地址的
fn fallback_detect_active_service() -> Result<String, AppError> {
    let output = Command::new(CMD_NETWORKSETUP)
        .arg(ARG_LIST_ALL_SERVICES)
        .output()
        .map_err(|e| AppError::new(format!("Failed to list network services: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines().skip(1) {
        let service = line.trim();
        if service.is_empty() || service.starts_with('*') {
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
                log::info!("[dns] Fallback: found active service \"{}\"", service);
                return Ok(service.to_string());
            }
        }
    }

    Err(AppError::new(ERR_NO_ACTIVE_SERVICE))
}

/// 获取指定网络服务的 DNS 服务器地址列表（无需管理员权限）
fn get_current_dns_servers(service_name: &str) -> Result<Vec<String>, AppError> {
    let output = Command::new(CMD_NETWORKSETUP)
        .arg(ARG_GET_DNS_SERVERS)
        .arg(service_name)
        .output()
        .map_err(|e| AppError::new(format!("Failed to query DNS servers: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let text = stdout.trim();

    if text.is_empty() || text.contains("aren't any DNS Servers") || text.contains("No DNS") {
        return Ok(Vec::new());
    }

    let servers: Vec<String> = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();

    Ok(servers)
}

/// 获取当前系统 DNS 状态
pub fn get_current_dns_status() -> Result<DnsStatus, AppError> {
    let network_service = detect_active_network_service()?;
    let dns_servers = get_current_dns_servers(&network_service)?;
    let is_custom = !dns_servers.is_empty();

    Ok(DnsStatus {
        current_servers: dns_servers,
        network_service,
        is_custom,
        latency: None,
    })
}

/// 运行带超时的命令，超时后自动 kill 进程
fn run_with_timeout(cmd: &mut Command, timeout_secs: u64) -> Result<std::process::Output, AppError> {
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AppError::new(format!("Failed to start command: {}", e)))?;

    let deadline = Instant::now() + Duration::from_secs(timeout_secs);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let output = child.wait_with_output()
                    .map_err(|e| AppError::new(format!("Failed to read command output: {}", e)))?;
                if status.success() {
                    return Ok(output);
                }
                let stderr = String::from_utf8_lossy(&output.stderr);
                let msg = stderr.trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout);
                let combined = if msg.is_empty() { stdout.trim().to_string() } else { msg };
                if combined.contains("User canceled") || combined.contains("authorization cancelled") {
                    log::info!("[dns] Admin prompt cancelled by user");
                    return Err(AppError::new("Operation cancelled by user"));
                }
                log::error!("[dns] Command failed: {}", combined);
                return Err(AppError::new(format!("Command failed: {}", combined)));
            }
            Ok(None) => {
                if Instant::now() > deadline {
                    log::error!("[dns] Command timed out after {}s, killing process", timeout_secs);
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(AppError::new(format!(
                        "DNS operation timed out after {} seconds. The admin permission dialog may be hidden behind the app window.",
                        timeout_secs
                    )));
                }
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(e) => {
                return Err(AppError::new(format!("Command error: {}", e)));
            }
        }
    }
}

/// 通过 osascript 请求管理员权限执行 networksetup 命令
fn run_networksetup_with_privileges(script: &str) -> Result<(), AppError> {
    let osa_script = format!(
        "do shell script \"{}\" with administrator privileges",
        script.replace('"', "\\\"")
    );

    let mut cmd = Command::new(CMD_OSASCRIPT);
    cmd.arg(ARG_E).arg(&osa_script);

    run_with_timeout(&mut cmd, DNS_SWITCH_TIMEOUT_SECS)?;
    Ok(())
}

/// 切换到指定的 DNS 服务器地址列表
pub fn switch_to_dns(_server_id: &str, addresses: &[String]) -> Result<(), AppError> {
    let service_name = detect_active_network_service()?;

    if addresses.is_empty() {
        log::error!("[dns] {}", ERR_NO_ADDRESSES);
        return Err(AppError::new(ERR_NO_ADDRESSES));
    }

    let escaped_service = service_name.replace('"', "\\\"");
    let addr_str = addresses
        .iter()
        .map(|a| a.trim())
        .filter(|a| !a.is_empty())
        .collect::<Vec<_>>()
        .join(" ");

    if addr_str.is_empty() {
        log::error!("[dns] All addresses empty after trimming");
        return Err(AppError::new(ERR_NO_ADDRESSES));
    }

    let script = format!(
        "{} {} \"{}\" {}",
        CMD_NETWORKSETUP, ARG_SET_DNS_SERVERS, escaped_service, addr_str
    );

    log::info!("[dns] Setting DNS for \"{}\": {}", service_name, addr_str);
    run_networksetup_with_privileges(&script)?;

    // 立即验证 DNS 是否设置成功
    let actual = get_current_dns_servers(&service_name)?;
    let expected: Vec<&str> = addresses.iter().map(|a| a.trim()).filter(|a| !a.is_empty()).collect();
    if actual.iter().map(|a| a.as_str()).collect::<Vec<&str>>() != expected {
        log::error!(
            "[dns] Verification failed: expected {:?}, got {:?}",
            expected, actual
        );
        return Err(AppError::new(format!(
            "DNS switch verification failed: expected {:?}, but got {:?}",
            expected, actual
        )));
    }

    log::info!("[dns] DNS switched and verified for \"{}\"", service_name);
    Ok(())
}

/// 恢复系统默认 DNS（清空自定义 DNS 设置）
pub fn reset_to_system_dns() -> Result<(), AppError> {
    let service_name = detect_active_network_service()?;
    let escaped_service = service_name.replace('"', "\\\"");

    let script = format!(
        "{} {} \"{}\" {}",
        CMD_NETWORKSETUP, ARG_SET_DNS_SERVERS, escaped_service, ARG_EMPTY
    );

    log::info!("[dns] Resetting DNS for \"{}\" to system default", service_name);
    run_networksetup_with_privileges(&script)?;

    // 验证已清空
    let actual = get_current_dns_servers(&service_name)?;
    if !actual.is_empty() {
        log::warn!("[dns] Reset verification: DNS still set to {:?}", actual);
    }

    log::info!("[dns] DNS reset successfully for \"{}\"", service_name);
    Ok(())
}
