use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use rustls::pki_types::ServerName;
use rustls::ClientConfig;

use super::query::{build_query, parse_response, RecordType};
use crate::dns::query::DnsQueryResult;
use crate::error::AppError;

const DOT_TIMEOUT_SECS: u64 = 10;
const DOT_DEFAULT_PORT: u16 = 853;

type TlsTcpStream = rustls::StreamOwned<rustls::ClientConnection, TcpStream>;

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

    let mut root_store = rustls::RootCertStore::empty();
    root_store.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

    let config = ClientConfig::builder()
        .with_root_certificates(root_store)
        .with_no_client_auth();

    let server_name = ServerName::try_from(addr.to_owned())
        .map_err(|e| AppError::new(format!("Invalid server name for DoT: {}", e)))?;

    let conn = rustls::ClientConnection::new(Arc::new(config), server_name)
        .map_err(|e| AppError::new(format!("Failed to create TLS connection: {}", e)))?;

    Ok(rustls::StreamOwned::new(conn, tcp))
}

fn now_millis() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64
}

fn query_dot(dot_address: &str, domain: &str, record_type_str: &str) -> Result<DnsQueryResult, AppError> {
    let record_type = RecordType::from_str(record_type_str)
        .ok_or_else(|| AppError::new(format!("Unsupported record type: {}", record_type_str)))?;

    let query_bytes = build_query(domain, record_type)?;
    let mut stream = connect_tls(dot_address)?;
    let start = Instant::now();

    let len_prefix = (query_bytes.len() as u16).to_be_bytes();
    stream.write_all(&len_prefix)
        .map_err(|e| AppError::new(format!("Failed to write length prefix: {}", e)))?;
    stream.write_all(&query_bytes)
        .map_err(|e| AppError::new(format!("Failed to write DNS query: {}", e)))?;
    stream.flush()
        .map_err(|e| AppError::new(format!("Failed to flush stream: {}", e)))?;

    let mut len_buf = [0u8; 2];
    stream.read_exact(&mut len_buf)
        .map_err(|e| AppError::new(format!("Failed to read response length: {}", e)))?;
    let response_len = u16::from_be_bytes(len_buf) as usize;

    let mut buf = vec![0u8; response_len];
    stream.read_exact(&mut buf)
        .map_err(|e| AppError::new(format!("Failed to read DNS response: {}", e)))?;

    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;
    let answers = parse_response(&buf, record_type)?;

    Ok(DnsQueryResult {
        domain: domain.to_string(),
        record_type: record_type_str.to_uppercase(),
        answers,
        server: format!("{}:{}", dot_address, DOT_DEFAULT_PORT),
        latency_ms,
        timestamp: now_millis(),
    })
}

pub fn resolve_via_dot(domain: &str, record_type_str: &str, dot_address: &str) -> Result<DnsQueryResult, AppError> {
    query_dot(dot_address, domain, record_type_str)
}

pub fn test_dot_connectivity(dot_address: &str) -> Result<f64, AppError> {
    let start = Instant::now();
    let _ = query_dot(dot_address, "example.com", "A")?;
    Ok(start.elapsed().as_secs_f64() * 1000.0)
}
