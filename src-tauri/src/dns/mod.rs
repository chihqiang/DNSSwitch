// ============================================================
// dns 模块 — DNS 核心逻辑
// 包含 DNS 解析、系统 DNS 管理、DoH/DoT、健康监控、定时调度引擎
// ============================================================

pub mod types;
pub mod resolver;
pub mod query;
pub mod history;
pub mod system_dns;
pub mod monitor;
pub mod doh;
pub mod dot;
pub mod provider;
pub mod schedule;
