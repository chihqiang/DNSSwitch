use std::time::{Duration, Instant};

use reqwest::Client;

use super::query::{build_query, parse_response, RecordType};
use crate::dns::query::DnsQueryResult;
use crate::error::AppError;

const DOH_TIMEOUT_SECS: u64 = 10;

pub async fn resolve_via_doh(
    domain: &str,
    record_type_str: &str,
    doh_url: &str,
) -> Result<DnsQueryResult, AppError> {
    let record_type = RecordType::from_str(record_type_str)
        .ok_or_else(|| AppError::new(format!("Unsupported record type: {}", record_type_str)))?;

    let query_bytes = build_query(domain, record_type)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(DOH_TIMEOUT_SECS))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| AppError::new(format!("Failed to create HTTP client: {}", e)))?;

    let start = Instant::now();
    let response = client
        .post(doh_url)
        .header("content-type", "application/dns-message")
        .header("accept", "application/dns-message")
        .body(query_bytes)
        .send()
        .await
        .map_err(|e| AppError::new(format!("DoH request failed: {}", e)))?;

    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    let status = response.status();
    if !status.is_success() {
        return Err(AppError::new(format!(
            "DoH server returned {}: {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("unknown")
        )));
    }

    let body = response
        .bytes()
        .await
        .map_err(|e| AppError::new(format!("Failed to read DoH response: {}", e)))?;

    let answers = parse_response(&body, record_type)?;

    Ok(DnsQueryResult {
        domain: domain.to_string(),
        record_type: record_type_str.to_uppercase(),
        answers,
        server: doh_url.to_string(),
        latency_ms,
    })
}

pub async fn test_doh_connectivity(doh_url: &str) -> Result<f64, AppError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(DOH_TIMEOUT_SECS))
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| AppError::new(format!("Failed to create HTTP client: {}", e)))?;

    let query_bytes = build_query("example.com", RecordType::A)?;

    let start = Instant::now();
    let response = client
        .post(doh_url)
        .header("content-type", "application/dns-message")
        .header("accept", "application/dns-message")
        .body(query_bytes)
        .send()
        .await
        .map_err(|e| AppError::new(format!("DoH connectivity test failed: {}", e)))?;

    let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

    if !response.status().is_success() {
        return Err(AppError::new(format!(
            "DoH server returned {}",
            response.status()
        )));
    }

    Ok(latency_ms)
}
