// ============================================================
// 原始 UDP DNS 解析器
// 手动构建 DNS 查询报文，通过 UDP 端口 53 发送 A 记录查询
// 用于延迟测试和基础解析场景
// ============================================================

use std::net::{SocketAddr, ToSocketAddrs, UdpSocket};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::error::AppError;

/// DNS 协议常量
const DNS_PORT: u16 = 53;
const DNS_TIMEOUT_SECS: u64 = 5;
const DNS_BUFFER_SIZE: usize = 512;
const DNS_HEADER_SIZE: usize = 12;
const DNS_RECORD_HEADER_SIZE: usize = 10;
const DNS_ANCOUNT_OFFSET: usize = 6;
const DNS_TYPE_A: u16 = 0x0001;
const DNS_CLASS_IN: u16 = 0x0001;
const DNS_FLAGS_STANDARD: u16 = 0x0100;
const DNS_QUESTION_COUNT: u16 = 0x0001;
const DNS_ANSWER_COUNT: u16 = 0x0000;
const DNS_AUTHORITY_COUNT: u16 = 0x0000;
const DNS_ADDITIONAL_COUNT: u16 = 0x0000;
const DNS_TYPE_OFFSET: usize = 2;
const DNS_RDLENGTH_OFFSET: usize = 8;
const DNS_IPV4_LEN: usize = 4;
const DNS_QUESTION_AFTER_NAME: usize = 4;
const DNS_LABEL_CONTINUE: u8 = 0x00;
const DNS_RESPONSE_MIN_SIZE: usize = 12;

/// 用于延迟测试的域名
const DNS_TEST_DOMAIN: &str = "one.one.one.one";
const DNS_BIND_ADDRESS: &str = "0.0.0.0:0";

/// 通过指定 DNS 服务器解析域名的 A 记录
pub fn resolve_domain(domain: &str, dns_server: &str) -> Result<Vec<String>, AppError> {
    let timeout = std::time::Duration::from_secs(DNS_TIMEOUT_SECS);

    let dns_addr: SocketAddr = format!("{}:{}", dns_server, DNS_PORT)
        .to_socket_addrs()?
        .next()
        .ok_or_else(|| AppError::new(format!("Invalid DNS server address: {}", dns_server)))?;

    let query = build_a_query(domain)?;
    let socket = UdpSocket::bind(DNS_BIND_ADDRESS)?;
    socket.set_read_timeout(Some(timeout))?;
    socket.send_to(&query, dns_addr)?;

    let mut buf = [0u8; DNS_BUFFER_SIZE];
    let len = socket.recv_from(&mut buf)?.0;

    let answers = parse_dns_response(&buf[..len])?;
    Ok(answers)
}

/// 测量 DNS 服务器延迟（通过解析测试域名的往返时间）
pub fn measure_latency(dns_server: &str) -> Result<f64, AppError> {
    let start = Instant::now();
    resolve_domain(DNS_TEST_DOMAIN, dns_server)?;
    Ok(start.elapsed().as_secs_f64() * 1000.0)
}

/// 构建 A 记录 DNS 查询报文
fn build_a_query(domain: &str) -> Result<Vec<u8>, AppError> {
    let mut buf = Vec::with_capacity(DNS_BUFFER_SIZE);

    // DNS 报文头（12 字节）
    let tid = (SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
        >> 16) as u16;
    buf.extend_from_slice(&tid.to_be_bytes());           // 事务 ID
    buf.extend_from_slice(&DNS_FLAGS_STANDARD.to_be_bytes()); // 标志位（标准查询）
    buf.extend_from_slice(&DNS_QUESTION_COUNT.to_be_bytes()); // 问题数 = 1
    buf.extend_from_slice(&DNS_ANSWER_COUNT.to_be_bytes());   // 回答数 = 0
    buf.extend_from_slice(&DNS_AUTHORITY_COUNT.to_be_bytes()); // 权威记录数 = 0
    buf.extend_from_slice(&DNS_ADDITIONAL_COUNT.to_be_bytes()); // 附加记录数 = 0

    // 问题区：域名编码（每个标签前加长度前缀）
    for part in domain.split('.') {
        buf.push(part.len() as u8);
        buf.extend_from_slice(part.as_bytes());
    }
    buf.push(DNS_LABEL_CONTINUE); // 域名终止符 0x00

    // 问题区：类型和类
    buf.extend_from_slice(&DNS_TYPE_A.to_be_bytes());     // 查询类型 A
    buf.extend_from_slice(&DNS_CLASS_IN.to_be_bytes());   // 查询类 IN

    Ok(buf)
}

/// 解析 DNS A 记录响应，提取 IPv4 地址列表
fn parse_dns_response(data: &[u8]) -> Result<Vec<String>, AppError> {
    if data.len() < DNS_RESPONSE_MIN_SIZE {
        return Err(AppError::new("Truncated DNS response"));
    }

    let ancount = u16::from_be_bytes([data[DNS_ANCOUNT_OFFSET], data[DNS_ANCOUNT_OFFSET + 1]]);
    let mut offset = DNS_HEADER_SIZE;

    // 跳过问题区中的域名 + QTYPE + QCLASS
    while offset < data.len() {
        if data[offset] == DNS_LABEL_CONTINUE {
            offset += 1;
            break;
        }
        let len = data[offset] as usize;
        if len == 0 {
            offset += 1;
            break;
        }
        offset += 1 + len;
    }

    offset += DNS_QUESTION_AFTER_NAME;
    let mut answers = Vec::new();

    // 遍历答案记录，提取 A 记录（IPv4）
    for _ in 0..ancount {
        if offset + DNS_RECORD_HEADER_SIZE > data.len() {
            break;
        }

        let typ = u16::from_be_bytes([
            data[offset + DNS_TYPE_OFFSET],
            data[offset + DNS_TYPE_OFFSET + 1],
        ]);
        let rdlength = u16::from_be_bytes([
            data[offset + DNS_RDLENGTH_OFFSET],
            data[offset + DNS_RDLENGTH_OFFSET + 1],
        ]) as usize;
        offset += DNS_RECORD_HEADER_SIZE;

        if offset + rdlength > data.len() {
            break;
        }

        if typ == DNS_TYPE_A && rdlength == DNS_IPV4_LEN {
            let ip = format!(
                "{}.{}.{}.{}",
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3]
            );
            answers.push(ip);
        }

        offset += rdlength;
    }

    Ok(answers)
}
