// ============================================================
// DNS-over-TLS (DoT) 查询模块
// 通过 TLS 加密的 TCP 连接发送 DNS 查询（RFC 7858），默认端口 853
// 每条 DNS 消息前附加 2 字节长度前缀
// ============================================================

use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

use native_tls::TlsConnector;

use super::query::{build_query, parse_response, RecordType};
use crate::dns::query::DnsQueryResult;
use crate::error::AppError;

/// DoT 默认超时和端口
const DOT_TIMEOUT_SECS: u64 = 10;
const DOT_DEFAULT_PORT: u16 = 853;

type TlsTcpStream = native_tls::TlsStream<TcpStream>;

/// 建立 TLS 加密的 TCP 连接到指定 DoT 服务器
fn connect_tls(addr: &str) -> Result<TlsTcpStream, AppError> {
    let timeout = Duration::from_secs(DOT_TIMEOUT_SECS);

    let tcp = TcpStream::connect_timeout(
        &format!("{}:{}", addr, DOT_DEFAULT_PORT)
            .to_socket_addrs()
            .map_err(|e| AppError::new(format!("Invalid DoT address: {}", e)))?
            .next()
            .ok_or_else(|| AppError::new(format!("Cannot resolve DoT address: {}", addr)))?,
        timeout,
    )
    .map_err(|e| AppError::new(format!("TCP connection failed for DoT: {}", e)))?;

    tcp.set_read_timeout(Some(timeout))
        .map_err(|e| AppError::new(format!("Failed to set read timeout: {}", e)))?;
    tcp.set_write_timeout(Some(timeout))
        .map_err(|e| AppError::new(format!("Failed to set write timeout: {}", e)))?;

    // 创建系统原生 TLS 连接器
    let connector = TlsConnector::new()
        .map_err(|e| AppError::new(format!("Failed to create TLS connector: {}", e)))?;

    let tls = connector
        .connect(addr, tcp)
        .map_err(|e| AppError::new(format!("TLS handshake failed for DoT: {}", e)))?;

    Ok(tls)
}

/// 通过 DoT 解析 DNS 查询
/// 发送格式：[2 字节长度前缀][DNS 查询报文]
pub fn resolve_via_dot(
    domain: &str,
    record_type_str: &str,
    dot_address: &str,
) -> Result<DnsQueryResult, AppError> {
    let record_type = RecordType::from_str(record_type_str)
        .ok_or_else(|| AppError::new(format!("Unsupported record type: {}", record_type_str)))?;

    let query_bytes = build_query(domain, record_type)?;

    let mut stream = connect_tls(dot_address)?;

    let start = Instant::now();

    // 写入长度前缀（2 字节大端序）+ DNS 查询报文
    let len_prefix = (query_bytes.len() as u16).to_be_bytes();
    stream
        .write_all(&len_prefix)
        .map_err(|e| AppError::new(format!("Failed to write length prefix: {}", e)))?;
    stream
        .write_all(&query_bytes)
        .map_err(|e| AppError::new(format!("Failed to write DNS query: {}", e)))?;
    stream
        .flush()
        .map_err(|e| AppError::new(format!("Failed to flush stream: {}", e)))?;

    // 读取响应长度前缀
    let mut len_buf = [0u8; 2];
    stream
        .read_exact(&mut len_buf)
        .map_err(|e| AppError::new(format!("Failed to read response length: {}", e)))?;
    let response_len = u16::from_be_bytes(len_buf) as usize;

    // 读取实际 DNS 响应
    let mut buf = vec![0u8; response_len];
    stream
        .read_exact(&mut buf)
        .map_err(|e| AppError::new(format!("Failed to read DNS response: {}", e)))?;

    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    let answers = parse_response(&buf, record_type)?;

    Ok(DnsQueryResult {
        domain: domain.to_string(),
        record_type: record_type_str.to_uppercase(),
        answers,
        server: format!("{}:{}", dot_address, DOT_DEFAULT_PORT),
        latency_ms,
    })
}

/// 测试 DoT 服务器连通性，返回延迟（毫秒）
pub fn test_dot_connectivity(dot_address: &str) -> Result<f64, AppError> {
    let record_type = RecordType::A;
    let query_bytes = build_query("example.com", record_type)?;

    let mut stream = connect_tls(dot_address)?;

    let start = Instant::now();

    let len_prefix = (query_bytes.len() as u16).to_be_bytes();
    stream
        .write_all(&len_prefix)
        .map_err(|e| AppError::new(format!("Failed to write length prefix: {}", e)))?;
    stream
        .write_all(&query_bytes)
        .map_err(|e| AppError::new(format!("Failed to write DNS query: {}", e)))?;
    stream
        .flush()
        .map_err(|e| AppError::new(format!("Failed to flush stream: {}", e)))?;

    let mut len_buf = [0u8; 2];
    stream
        .read_exact(&mut len_buf)
        .map_err(|e| AppError::new(format!("Failed to read response length: {}", e)))?;
    let response_len = u16::from_be_bytes(len_buf) as usize;

    let mut buf = vec![0u8; response_len];
    stream
        .read_exact(&mut buf)
        .map_err(|e| AppError::new(format!("Failed to read DNS response: {}", e)))?;

    Ok(start.elapsed().as_secs_f64() * 1000.0)
}
