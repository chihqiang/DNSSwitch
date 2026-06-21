use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub hostname: String,
    pub kernel_version: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkService {
    pub name: String,
    pub display_name: String,
    pub is_active: bool,
    pub dns_servers: Vec<String>,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    let os = std::env::consts::OS.to_string();
    let hostname = get_hostname();
    let os_version = get_os_version();
    let kernel_version = get_kernel_version();

    Ok(SystemInfo {
        os,
        os_version,
        hostname,
        kernel_version,
    })
}

#[tauri::command]
pub fn get_network_services() -> Result<Vec<NetworkService>, String> {
    platform::get_network_services()
}

fn get_hostname() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
        .unwrap_or_else(|| "unknown".to_string())
}

fn get_os_version() -> String {
    platform::get_os_version()
}

fn get_kernel_version() -> String {
    platform::get_kernel_version()
}

#[cfg(target_os = "macos")]
mod platform {
    use super::NetworkService;

    pub fn get_network_services() -> Result<Vec<NetworkService>, String> {
        let output = std::process::Command::new("networksetup")
            .arg("-listallnetworkservices")
            .output()
            .map_err(|e| format!("Failed to list network services: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut services = Vec::new();

        for line in stdout.lines().skip(1) {
            let name = line.trim().to_string();
            if name.is_empty() || name.starts_with('*') {
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

    fn get_service_dns(service_name: &str) -> Vec<String> {
        let output = std::process::Command::new("networksetup")
            .arg("-getdnsservers")
            .arg(service_name)
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                stdout
                    .lines()
                    .filter(|l| {
                        !l.is_empty()
                            && !l.contains("empty")
                            && !l.contains("there aren't")
                    })
                    .map(|l| l.trim().to_string())
                    .collect()
            }
            Err(_) => Vec::new(),
        }
    }

    pub fn get_os_version() -> String {
        std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }

    pub fn get_kernel_version() -> String {
        std::process::Command::new("uname")
            .arg("-r")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::NetworkService;

    pub fn get_network_services() -> Result<Vec<NetworkService>, String> {
        let mut services = Vec::new();

        if let Ok(output) = std::process::Command::new("nmcli")
            .args(["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                if line.is_empty() { continue; }
                let parts: Vec<&str> = line.splitn(2, ':').collect();
                let display_name = parts[0].trim().to_string();
                services.push(NetworkService {
                    name: parts.get(1).unwrap_or(&"").trim().to_string(),
                    display_name,
                    is_active: true,
                    dns_servers: Vec::new(),
                });
            }
        }

        if services.is_empty() {
            services.push(NetworkService {
                name: "unknown".to_string(),
                display_name: "System (resolvectl)".to_string(),
                is_active: true,
                dns_servers: Vec::new(),
            });
        }

        Ok(services)
    }

    pub fn get_os_version() -> String {
        let output = std::process::Command::new("sh")
            .args(["-c", ". /etc/os-release && echo \"$PRETTY_NAME\""])
            .output()
            .ok()
            .and_then(|o| {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if s.is_empty() { None } else { Some(s) }
            });

        match output {
            Some(v) => v,
            None => {
                std::process::Command::new("sh")
                    .args(["-c", ". /etc/os-release 2>/dev/null && echo \"$NAME $VERSION_ID\""])
                    .output()
                    .ok()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "unknown".to_string())
            }
        }
    }

    pub fn get_kernel_version() -> String {
        std::process::Command::new("uname")
            .arg("-r")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::NetworkService;

    pub fn get_network_services() -> Result<Vec<NetworkService>, String> {
        let output = std::process::Command::new("netsh")
            .args(["interface", "show", "interface"])
            .output()
            .map_err(|e| format!("Failed to list interfaces: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut services = Vec::new();

        for line in stdout.lines() {
            let t = line.trim();
            if t.contains("Connected") || t.contains("已连接") {
                let parts: Vec<&str> = t.split_whitespace().collect();
                if let Some(name) = parts.last() {
                    let display = name.to_string();
                    services.push(NetworkService {
                        name: display.clone(),
                        display_name: display,
                        is_active: true,
                        dns_servers: Vec::new(),
                    });
                }
            }
        }

        if services.is_empty() {
            services.push(NetworkService {
                name: "unknown".to_string(),
                display_name: "System (netsh)".to_string(),
                is_active: true,
                dns_servers: Vec::new(),
            });
        }

        Ok(services)
    }

    pub fn get_os_version() -> String {
        std::process::Command::new("cmd")
            .args(["/c", "ver"])
            .output()
            .ok()
            .map(|o| {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                s.replace("\r\n", " ").replace('\r', "").replace('\n', "").trim().to_string()
            })
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "unknown".to_string())
    }

    pub fn get_kernel_version() -> String {
        std::process::Command::new("wmic")
            .args(["os", "get", "Version", "/value"])
            .output()
            .ok()
            .and_then(|o| {
                let s = String::from_utf8_lossy(&o.stdout);
                s.lines()
                    .find_map(|l| l.trim().strip_prefix("Version=").map(|v| v.to_string()))
            })
            .unwrap_or_else(|| "unknown".to_string())
    }
}
