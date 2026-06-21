// ============================================================
// 系统 DNS 管理（跨平台：macOS / Linux / Windows）
// macOS:  networksetup + osascript
// Linux:  resolvectl (systemd-resolved) > nmcli (NetworkManager)
// Windows: netsh
// ============================================================

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::AppError;
use super::types::DnsStatus;

const DNS_SWITCH_TIMEOUT_SECS: u64 = 30;

// ============================================================================
// 公共 API：各平台内部实现后，统一从这里导出语义
// ============================================================================

/// 获取当前系统 DNS 状态
pub fn get_current_dns_status() -> Result<DnsStatus, AppError> {
    let (service_name, dns_servers) = platform::get_current_dns()?;
    let chrome_doh = super::chrome_dns::get_chrome_doh().ok().flatten();
    Ok(DnsStatus {
        current_servers: dns_servers,
        network_service: service_name,
        is_custom: true,
        latency: None,
        chrome_doh_url: chrome_doh,
    })
}

/// 切换到指定的 DNS 服务器地址列表
pub fn switch_to_dns(_server_id: &str, addresses: &[String]) -> Result<(), AppError> {
    let addrs: Vec<&str> = addresses.iter().map(|a| a.trim()).filter(|a| !a.is_empty()).collect();
    if addrs.is_empty() {
        return Err(AppError::new("No DNS addresses provided"));
    }
    platform::set_dns(&addrs)?;
    // 验证
    let (_, actual) = platform::get_current_dns()?;
    let actual_strs: Vec<&str> = actual.iter().map(|s| s.as_str()).collect();
    if actual_strs != addrs {
        return Err(AppError::new(format!(
            "DNS switch verification failed: expected {:?}, got {:?}", addrs, actual_strs
        )));
    }
    Ok(())
}

/// 恢复系统默认 DNS
pub fn reset_to_system_dns() -> Result<(), AppError> {
    platform::reset_dns()
}

// ============================================================================
// 通用工具函数
// ============================================================================

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
                let lower = combined.to_lowercase();
                if lower.contains("user canceled")
                    || lower.contains("authorisation cancelled")
                    || lower.contains("authorization cancelled")
                    || lower.contains("ismissing")
                    || lower.contains("(-128)")
                    || lower.contains("已取消")
                    || lower.contains("cancelled by user")
                {
                    log::info!("[dns] Privilege prompt cancelled by user");
                    return Err(AppError::new("操作已取消"));
                }
                log::error!("[dns] Command failed: {}", combined);
                return Err(AppError::new(format!("Command failed: {}", combined)));
            }
            Ok(None) => {
                if Instant::now() > deadline {
                    log::error!("[dns] Timed out after {}s, killing", timeout_secs);
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(AppError::new(format!(
                        "DNS operation timed out after {} seconds", timeout_secs
                    )));
                }
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(e) => return Err(AppError::new(format!("Command error: {}", e))),
        }
    }
}

fn run_cmd(program: &str, args: &[&str]) -> Result<String, AppError> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| AppError::new(format!("Failed to run {}: {}", program, e)))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

// ============================================================================
// 平台实现
// ============================================================================

// ---- macOS ----------------------------------------------------------------

#[cfg(target_os = "macos")]
mod platform {
    use crate::error::AppError;

    pub fn get_current_dns() -> Result<(String, Vec<String>), AppError> {
        let svc = detect_service()?;
        let servers = get_dns_servers(&svc)?;
        Ok((svc, servers))
    }

    pub fn set_dns(addresses: &[&str]) -> Result<(), AppError> {
        let svc = detect_service()?;
        let addr_str = addresses.join(" ");
        let script = format!("networksetup -setdnsservers \"{}\" {}", svc.replace('"', "\\\""), addr_str);
        log::info!("[dns:mac] setting DNS on \"{}\": {}", svc, addr_str);
        run_with_privileges(&script)
    }

    pub fn reset_dns() -> Result<(), AppError> {
        let svc = detect_service()?;
        let script = format!("networksetup -setdnsservers \"{}\" empty", svc.replace('"', "\\\""));
        log::info!("[dns:mac] resetting DNS on \"{}\"", svc);
        run_with_privileges(&script)
    }

    fn detect_service() -> Result<String, AppError> {
        // 1. 从默认路由获取接口设备
        let route_out = super::run_cmd("route", &["-n", "get", "default"])?;
        let device = route_out.lines()
            .find_map(|l| l.trim().strip_prefix("interface:").map(|s| s.trim().to_string()))
            .ok_or_else(|| AppError::new("No default route interface"))?;
        log::info!("[dns:mac] default route device: {}", device);
        // 2. 映射 device → network service name
        let ports = super::run_cmd("networksetup", &["-listallhardwareports"])?;
        let mut cur: Option<String> = None;
        for line in ports.lines() {
            let t = line.trim();
            if let Some(p) = t.strip_prefix("Hardware Port: ") { cur = Some(p.trim().to_string()); }
            else if let Some(d) = t.strip_prefix("Device: ") {
                if d.trim() == device { if let Some(s) = cur { return Ok(s); } }
            }
        }
        // 3. 回退：扫列表
        let all = super::run_cmd("networksetup", &["-listallnetworkservices"])?;
        for svc in all.lines().skip(1).map(|l| l.trim()).filter(|l| !l.is_empty() && !l.starts_with('*')) {
            let info = super::run_cmd("networksetup", &["-getinfo", svc]).unwrap_or_default();
            if (info.contains("DHCP") || info.contains("Manual")) && info.contains("IP address:") {
                return Ok(svc.to_string());
            }
        }
        Err(AppError::new("No active network service found"))
    }

    fn get_dns_servers(svc: &str) -> Result<Vec<String>, AppError> {
        let out = super::run_cmd("networksetup", &["-getdnsservers", svc])?;
        if out.contains("aren't any DNS Servers") || out.contains("No DNS") {
            return Ok(vec![]);
        }
        Ok(out.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
    }

    fn run_with_privileges(script: &str) -> Result<(), AppError> {
        let osa = format!("do shell script \"{}\" with administrator privileges", script.replace('"', "\\\""));
        let mut cmd = std::process::Command::new("osascript");
        cmd.arg("-e").arg(&osa);
        super::run_with_timeout(&mut cmd, super::DNS_SWITCH_TIMEOUT_SECS)?;
        Ok(())
    }
}

// ---- Linux ----------------------------------------------------------------

#[cfg(target_os = "linux")]
mod platform {
    use crate::error::AppError;

    pub fn get_current_dns() -> Result<(String, Vec<String>), AppError> {
        if has_resolvectl() {
            return get_current_dns_resolvectl();
        }
        if has_nmcli() {
            return get_current_dns_nmcli();
        }
        Err(AppError::new("No supported DNS manager (resolvectl or nmcli) found"))
    }

    pub fn set_dns(addresses: &[&str]) -> Result<(), AppError> {
        if has_resolvectl() {
            return set_dns_resolvectl(addresses);
        }
        if has_nmcli() {
            return set_dns_nmcli(addresses);
        }
        Err(AppError::new("No supported DNS manager (resolvectl or nmcli) found"))
    }

    pub fn reset_dns() -> Result<(), AppError> {
        if has_resolvectl() {
            return reset_dns_resolvectl();
        }
        if has_nmcli() {
            return reset_dns_nmcli();
        }
        Err(AppError::new("No supported DNS manager (resolvectl or nmcli) found"))
    }

    fn has_resolvectl() -> bool {
        std::process::Command::new("resolvectl").arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
    }

    fn has_nmcli() -> bool {
        std::process::Command::new("nmcli").arg("--version").output().map(|o| o.status.success()).unwrap_or(false)
    }

    fn get_iface() -> Result<String, AppError> {
        let out = super::run_cmd("ip", &["route", "show", "default"])?;
        // "default via 192.168.1.1 dev wlan0 proto dhcp metric 600"
        for line in out.lines() {
            if line.contains("default") {
                if let Some(dev) = line.split_whitespace().skip_while(|w| *w != "dev").nth(1) {
                    return Ok(dev.to_string());
                }
            }
        }
        Err(AppError::new("No default route interface"))
    }

    // ---- resolvectl ----

    fn get_current_dns_resolvectl() -> Result<(String, Vec<String>), AppError> {
        let iface = get_iface()?;
        let out = super::run_cmd("resolvectl", &["status", &iface]).unwrap_or_default();
        let mut servers = Vec::new();
        for line in out.lines() {
            if line.trim().starts_with("DNS Servers:") {
                let ips: Vec<&str> = line.split(':').nth(1).unwrap_or("").split_whitespace().collect();
                servers.extend(ips.iter().map(|s| s.to_string()));
            }
        }
        Ok((iface, servers))
    }

    fn set_dns_resolvectl(addresses: &[&str]) -> Result<(), AppError> {
        let iface = get_iface()?;
        let mut args = vec!["dns", &iface];
        args.extend(addresses);
        log::info!("[dns:linux] resolvectl dns {} {:?}", iface, addresses);
        super::run_with_pkexec("resolvectl", &args)?;
        Ok(())
    }

    fn reset_dns_resolvectl() -> Result<(), AppError> {
        let iface = get_iface()?;
        log::info!("[dns:linux] resolvectl revert {}", iface);
        super::run_with_pkexec("resolvectl", &["revert", &iface])?;
        Ok(())
    }

    // ---- nmcli (fallback) ----

    fn get_connection_name() -> Result<String, AppError> {
        let out = super::run_cmd("nmcli", &["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"])?;
        let iface = get_iface()?;
        for line in out.lines() {
            if line.contains(&iface) {
                return Ok(line.split(':').next().unwrap_or(&iface).to_string());
            }
        }
        Ok(iface)
    }

    fn get_current_dns_nmcli() -> Result<(String, Vec<String>), AppError> {
        let conn = get_connection_name()?;
        let out = super::run_cmd("nmcli", &["-t", "-f", "IP4.DNS", "connection", "show", &conn]).unwrap_or_default();
        let servers: Vec<String> = out.lines()
            .flat_map(|l| l.split(':'))
            .filter(|s| !s.is_empty() && s.contains('.'))
            .map(|s| s.split('|').next().unwrap_or(s).to_string())
            .collect();
        Ok((conn, servers))
    }

    fn set_dns_nmcli(addresses: &[&str]) -> Result<(), AppError> {
        let conn = get_connection_name()?;
        let dns_str = addresses.join(",");
        log::info!("[dns:linux] nmcli modify {} dns={}", conn, dns_str);
        super::run_with_pkexec("nmcli", &["connection", "modify", &conn, "ipv4.dns", &dns_str])?;
        super::run_with_pkexec("nmcli", &["connection", "modify", &conn, "ipv4.ignore-auto-dns", "yes"])?;
        super::run_with_pkexec("nmcli", &["connection", "down", &conn])?;
        super::run_with_pkexec("nmcli", &["connection", "up", &conn])?;
        Ok(())
    }

    fn reset_dns_nmcli() -> Result<(), AppError> {
        let conn = get_connection_name()?;
        log::info!("[dns:linux] nmcli reset {}", conn);
        super::run_with_pkexec("nmcli", &["connection", "modify", &conn, "ipv4.dns", ""])?;
        super::run_with_pkexec("nmcli", &["connection", "modify", &conn, "ipv4.ignore-auto-dns", "no"])?;
        super::run_with_pkexec("nmcli", &["connection", "down", &conn])?;
        super::run_with_pkexec("nmcli", &["connection", "up", &conn])?;
        Ok(())
    }

    fn run_with_pkexec(program: &str, args: &[&str]) -> Result<(), AppError> {
        let mut all = vec![program];
        all.extend(args);

        let mut run_as_root = |launcher: &str, launcher_args: &[&str]| -> Result<(), AppError> {
            let mut cmd = std::process::Command::new(launcher);
            cmd.args(launcher_args).args(&all);
            super::run_with_timeout(&mut cmd, super::DNS_SWITCH_TIMEOUT_SECS)
        };

        // Try pkexec (GNOME), then sudo with askpass, then kdesudo (KDE)
        let candidates: &[(&str, &[&str])] = &[
            ("pkexec", &[]),
            ("sudo", &["-A"]),
            ("kdesudo", &[]),
        ];

        for (launcher, extra_args) in candidates {
            if std::process::Command::new(launcher)
                .arg("--version")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
            {
                return run_as_root(launcher, extra_args);
            }
        }

        Err(AppError::new(
            "No privilege escalation tool found (try: pkexec, sudo -A, or kdesudo)"
        ))
    }
}

// ---- Windows --------------------------------------------------------------

#[cfg(target_os = "windows")]
mod platform {
    use crate::error::AppError;

    pub fn get_current_dns() -> Result<(String, Vec<String>), AppError> {
        let iface = get_active_iface()?;
        let out = super::run_cmd("netsh", &["interface", "ip", "show", "dnsservers", &iface])?;
        let mut servers = Vec::new();
        for line in out.lines() {
            let t = line.trim();
            if t.contains('.') && !t.contains(':') && !t.contains("DNS") && !t.contains("---") {
                if let Ok(_) = t.parse::<std::net::Ipv4Addr>() {
                    servers.push(t.to_string());
                }
            }
        }
        Ok((iface, servers))
    }

    pub fn set_dns(addresses: &[&str]) -> Result<(), AppError> {
        let iface = get_active_iface()?;
        log::info!("[dns:win] netsh set dns on \"{}\": {:?}", iface, addresses);
        run_netsh(&["interface", "ip", "set", "dns", &iface, "static", addresses[0]])?;
        for addr in &addresses[1..] {
            run_netsh(&["interface", "ip", "add", "dns", &iface, addr, "index=2"])?;
        }
        Ok(())
    }

    pub fn reset_dns() -> Result<(), AppError> {
        let iface = get_active_iface()?;
        log::info!("[dns:win] netsh reset dns on \"{}\"", iface);
        run_netsh(&["interface", "ip", "set", "dns", &iface, "dhcp"])?;
        Ok(())
    }

    /// Run netsh with admin elevation via PowerShell Start-Process
    fn run_netsh(args: &[&str]) -> Result<(), AppError> {
        let arg_str = args.join(" ");
        let ps_script = format!(
            "Start-Process netsh -ArgumentList '{}' -Verb RunAs -Wait -WindowStyle Hidden",
            arg_str.replace('\'', "''")
        );
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps_script])
            .output()
            .map_err(|e| AppError::new(format!("Failed to start elevated netsh: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::new(format!("netsh elevation failed: {}", stderr.trim())));
        }
        Ok(())
    }

    fn get_active_iface() -> Result<String, AppError> {
        // netsh interface show interface → 找状态为 "Connected" 的
        let out = super::run_cmd("netsh", &["interface", "show", "interface"])?;
        for line in out.lines() {
            if line.contains("Connected") || line.contains("已连接") {
                // 格式：Enabled   Connected       Dedicated        Ethernet 2
                let parts: Vec<&str> = line.split_whitespace().collect();
                // 最后一个非空字段就是接口名
                if let Some(name) = parts.last() {
                    return Ok(name.to_string());
                }
            }
        }
        // 回退：查默认路由
        let route_out = super::run_cmd("route", &["print", "0.0.0.0"])?;
        for line in route_out.lines() {
            if line.contains("0.0.0.0") && !line.contains("On-link") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 4 { return Ok(parts[3].to_string()); }
            }
        }
        Err(AppError::new("No active network interface found"))
    }
}
