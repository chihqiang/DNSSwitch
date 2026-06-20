// 前端日志桥接：通过 Tauri IPC 将日志发送到 Rust 后端统一输出
import { invoke } from '@tauri-apps/api/core';

async function logMessage(level: string, message: string) {
  try {
    await invoke('log_message', { level, message });
  } catch {
    // 静默忽略日志发送失败，避免影响业务逻辑
  }
}

export const logger = {
  trace: (msg: string) => logMessage('trace', msg),
  debug: (msg: string) => logMessage('debug', msg),
  info: (msg: string) => logMessage('info', msg),
  warn: (msg: string) => logMessage('warn', msg),
  error: (msg: string) => logMessage('error', msg),
};
