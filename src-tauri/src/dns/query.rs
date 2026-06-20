// ============================================================
// 通用 DNS 查询引擎
// 支持 A、AAAA、MX、TXT、NS、CNAME、SOA 记录类型
// 通过 UDP 端口 53 发送查询并解析响应
// ============================================================

use std::net::{SocketAddr, ToSocketAddrs, UdpSocket};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::error::AppError;

/// DNS 协议常量
const DNS_PORT: u16 = 53;
const DNS_TIMEOUT_SECS: u64 = 5;
const DNS_BUFFER_SIZE: usize = 512;
const DNS_HEADER_SIZE: usize = 12;
const DNS_FLAGS_STANDARD: u16 = 0x0100;
const DNS_CLASS_IN: u16 = 0x0001;

/// DNS 指针压缩标记（高两位为 1 表示指针）
const DNS_POINTER_MASK: u8 = 0xc0;

/// DNS 查询结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsQueryResult {
    pub domain: String,
    pub record_type: String,
    pub answers: Vec<String>,
    pub server: String,
    pub latency_ms: f64,
}

/// DNS 记录类型枚举
#[derive(Debug, Clone, Copy, PartialEq)]
#[expect(clippy::upper_case_acronyms)]
pub enum RecordType {
    A,      // IPv4 地址
    AAAA,   // IPv6 地址
    MX,     // 邮件交换记录
    TXT,    // 文本记录
    NS,     // 权威名称服务器
    CNAME,  // 别名记录
    SOA,    // 起始授权记录
}

impl RecordType {
    /// 将记录类型转为 DNS 协议中对应的类型值
    pub fn to_u16(self) -> u16 {
        match self {
            RecordType::A => 0x0001,
            RecordType::AAAA => 0x001c,
            RecordType::MX => 0x000f,
            RecordType::TXT => 0x0010,
            RecordType::NS => 0x0002,
            RecordType::CNAME => 0x0005,
            RecordType::SOA => 0x0006,
        }
    }

    /// 从字符串解析记录类型（不区分大小写）
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "A" => Some(RecordType::A),
            "AAAA" => Some(RecordType::AAAA),
            "MX" => Some(RecordType::MX),
            "TXT" => Some(RecordType::TXT),
            "NS" => Some(RecordType::NS),
            "CNAME" => Some(RecordType::CNAME),
            "SOA" => Some(RecordType::SOA),
            _ => None,
        }
    }
}

/// 将域名字符串编码为 DNS 标签格式（每个标签前加长度前缀）
fn encode_dns_name(name: &str) -> Vec<u8> {
    let mut buf = Vec::new();
    for part in name.split('.') {
        buf.push(part.len() as u8);
        buf.extend_from_slice(part.as_bytes());
    }
    buf.push(0x00); // 终止符
    buf
}

/// 解码 DNS 名称（支持指针压缩），从指定偏移量开始读取
fn decode_dns_name(data: &[u8], offset: &mut usize) -> Result<String, AppError> {
    let mut parts = Vec::new();
    let mut jumped = false;
    let mut pos = *offset;

    if pos >= data.len() {
        return Err(AppError::new("Truncated DNS name"));
    }

    let mut len = data[pos];
    while len != 0 {
        // 指针压缩：高两位为 1 时，后续 14 位为偏移量
        if len & DNS_POINTER_MASK == DNS_POINTER_MASK {
            if pos + 2 > data.len() {
                return Err(AppError::new("Truncated DNS pointer"));
            }
            let ptr = ((len as u16 & !0xc0) << 8) | data[pos + 1] as u16;
            if !jumped {
                *offset = pos + 2;
            }
            pos = ptr as usize;
            jumped = true;
            if pos >= data.len() {
                return Err(AppError::new("Invalid DNS pointer"));
            }
            len = data[pos];
            continue;
        }

        if pos + 1 + len as usize > data.len() {
            return Err(AppError::new("Truncated DNS label"));
        }
        pos += 1;
        let label = &data[pos..pos + len as usize];
        parts.push(std::str::from_utf8(label).map_err(|_| AppError::new("Invalid UTF-8 in DNS name"))?);
        pos += len as usize;
        if pos >= data.len() {
            return Err(AppError::new("Truncated DNS name"));
        }
        len = data[pos];
    }

    if !jumped {
        *offset = pos + 1;
    }

    Ok(parts.join("."))
}

/// 构建 DNS 查询报文（支持多种记录类型）
pub fn build_query(domain: &str, record_type: RecordType) -> Result<Vec<u8>, AppError> {
    let tid = (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
        >> 16) as u16;

    let mut buf = Vec::with_capacity(DNS_BUFFER_SIZE);
    // DNS 报文头（12 字节）
    buf.extend_from_slice(&tid.to_be_bytes());              // 事务 ID
    buf.extend_from_slice(&DNS_FLAGS_STANDARD.to_be_bytes()); // 标志位
    buf.extend_from_slice(&1u16.to_be_bytes());              // 问题数
    buf.extend_from_slice(&0u16.to_be_bytes());              // 回答数
    buf.extend_from_slice(&0u16.to_be_bytes());              // 权威记录数
    buf.extend_from_slice(&0u16.to_be_bytes());              // 附加记录数

    // 问题区：域名 + 类型 + 类
    buf.extend_from_slice(&encode_dns_name(domain));
    buf.extend_from_slice(&record_type.to_u16().to_be_bytes());
    buf.extend_from_slice(&DNS_CLASS_IN.to_be_bytes());

    Ok(buf)
}

/// 通过指定 DNS 服务器解析域名
pub fn resolve(domain: &str, record_type_str: &str, dns_server: &str) -> Result<DnsQueryResult, AppError> {
    let record_type = RecordType::from_str(record_type_str)
        .ok_or_else(|| AppError::new(format!("Unsupported record type: {}", record_type_str)))?;

    let dns_addr: SocketAddr = format!("{}:{}", dns_server, DNS_PORT)
        .to_socket_addrs()
        .map_err(|e| AppError::new(format!("Invalid DNS server: {}", e)))?
        .next()
        .ok_or_else(|| AppError::new(format!("Cannot resolve DNS server: {}", dns_server)))?;

    let query = build_query(domain, record_type)?;
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    let timeout = Duration::from_secs(DNS_TIMEOUT_SECS);
    socket.set_read_timeout(Some(timeout))?;

    let start = Instant::now();
    socket.send_to(&query, dns_addr)?;

    let mut buf = [0u8; DNS_BUFFER_SIZE];
    let len = socket.recv_from(&mut buf)?.0;
    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    let answers = parse_response(&buf[..len], record_type)?;

    Ok(DnsQueryResult {
        domain: domain.to_string(),
        record_type: record_type_str.to_uppercase(),
        answers,
        server: dns_server.to_string(),
        latency_ms,
    })
}

/// 解析 DNS 响应报文，提取指定类型的记录数据
pub fn parse_response(data: &[u8], expected_type: RecordType) -> Result<Vec<String>, AppError> {
    if data.len() < DNS_HEADER_SIZE {
        return Err(AppError::new("Truncated DNS response"));
    }

    // 检查 DNS 响应码（rcode 在第三个字节的低 4 位）
    let rcode = data[3] & 0x0f;
    if rcode != 0 {
        let reason = match rcode {
            1 => "Format error",
            2 => "Server failure",
            3 => "NXDOMAIN (domain does not exist)",
            4 => "Not implemented",
            5 => "Refused",
            _ => "Unknown error",
        };
        return Err(AppError::new(format!("DNS error ({}): {}", rcode, reason)));
    }

    let ancount = u16::from_be_bytes([data[6], data[7]]) as usize;
    let mut offset = DNS_HEADER_SIZE;

    // 跳过问题区：域名 + QTYPE + QCLASS
    decode_dns_name(data, &mut offset)?;
    offset += 4;

    let mut answers = Vec::new();

    for _ in 0..ancount {
        if offset >= data.len() {
            break;
        }

        offset = skip_name(data, offset)?;

        if offset + 10 > data.len() {
            break;
        }

        let rtype = u16::from_be_bytes([data[offset], data[offset + 1]]);
        let rdlength = u16::from_be_bytes([data[offset + 8], data[offset + 9]]) as usize;
        offset += 10;

        if offset + rdlength > data.len() {
            break;
        }

        if rtype == expected_type.to_u16() || rtype == 5 {
            let rdata = &data[offset..offset + rdlength];
            match rtype {
                1 if rdlength == 4 => {
                    // A 记录：4 字节 IPv4 地址
                    answers.push(format!("{}.{}.{}.{}", rdata[0], rdata[1], rdata[2], rdata[3]));
                }
                28 if rdlength == 16 => {
                    // AAAA 记录：16 字节 IPv6 地址
                    let hex: Vec<String> = rdata.chunks(2).map(|c| format!("{:02x}{:02x}", c[0], c[1])).collect();
                    answers.push(hex.join(":"));
                }
                5 | 2 => {
                    // CNAME / NS：域名
                    if let Ok(n) = decode_dns_name(rdata, &mut 0) {
                        answers.push(n);
                    }
                }
                15 if rdlength >= 3 => {
                    // MX 记录：2 字节优先级 + 域名
                    let preference = u16::from_be_bytes([rdata[0], rdata[1]]);
                    if let Ok(name) = decode_dns_name(rdata, &mut 2) {
                        answers.push(format!("{} {}", preference, name));
                    }
                }
                16 => {
                    // TXT 记录：可能包含多个字符段
                    let mut txt_offset = 0;
                    while txt_offset < rdlength {
                        let txt_len = rdata[txt_offset] as usize;
                        txt_offset += 1;
                        if txt_offset + txt_len <= rdlength {
                            if let Ok(s) = std::str::from_utf8(&rdata[txt_offset..txt_offset + txt_len]) {
                                answers.push(s.to_string());
                            }
                            txt_offset += txt_len;
                        }
                    }
                }
                6 if rdlength >= 20 => {
                    // SOA 记录：主服务器名 + 管理员邮箱 + 序列号
                    let mut soa_offset = 0;
                    let mname = decode_dns_name(rdata, &mut soa_offset)?;
                    let rname = decode_dns_name(rdata, &mut soa_offset)?;
                    if soa_offset + 20 <= rdlength {
                        let serial = u32::from_be_bytes([
                            rdata[soa_offset], rdata[soa_offset + 1],
                            rdata[soa_offset + 2], rdata[soa_offset + 3],
                        ]);
                        answers.push(format!("{} {} (serial: {})", mname, rname, serial));
                    }
                }
                _ => {}
            }
        }

        offset += rdlength;
    }

    Ok(answers)
}

/// 跳跃 DNS 名称（处理普通标签和指针压缩），返回名称后的偏移量
fn skip_name(data: &[u8], offset: usize) -> Result<usize, AppError> {
    let mut pos = offset;
    loop {
        if pos >= data.len() {
            return Err(AppError::new("Truncated DNS name in skip"));
        }
        let len = data[pos];
        // 指针压缩：跳 2 字节
        if len & DNS_POINTER_MASK == DNS_POINTER_MASK {
            pos += 2;
            break;
        }
        // 终止符：跳 1 字节
        if len == 0 {
            pos += 1;
            break;
        }
        pos += 1 + len as usize;
    }
    Ok(pos)
}
