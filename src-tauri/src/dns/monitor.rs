use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use super::resolver::measure_latency;

#[allow(dead_code)]
pub struct DnsMonitor {
    running: Arc<AtomicBool>,
}

#[allow(dead_code)]
impl DnsMonitor {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn start<F>(&self, interval_ms: u64, servers: Vec<String>, callback: F)
    where
        F: Fn(String, f64) + Send + 'static,
    {
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();

        thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                for server in &servers {
                    if !running.load(Ordering::SeqCst) {
                        break;
                    }

                    if let Ok(latency) = measure_latency(server) {
                        callback(server.clone(), latency);
                    }
                }

                thread::sleep(Duration::from_millis(interval_ms));
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
