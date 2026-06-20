// ============================================================
// 系统信息、网络接口、网络服务等类型定义
// ============================================================

/** 网络接口类型 */
export const NetworkInterfaceType = {
  WIFI: 'wifi',
  ETHERNET: 'ethernet',
  CELLULAR: 'cellular',
  VPN: 'vpn',
  OTHER: 'other',
} as const;
export type NetworkInterfaceType = (typeof NetworkInterfaceType)[keyof typeof NetworkInterfaceType];

/** 网络服务（macOS 上对应不同的网络位置/服务） */
export interface NetworkService {
  name: string;
  displayName: string;
  /** 是否当前活跃 */
  isActive: boolean;
  /** 该服务配置的 DNS 服务器地址 */
  dnsServers: string[];
}

/** 物理网络接口 */
export interface NetworkInterface {
  name: string;
  displayName: string;
  type: NetworkInterfaceType;
  isActive: boolean;
  dnsServers: string[];
}

/** 操作系统信息 */
export interface SystemInfo {
  os: string;
  osVersion: string;
  hostname: string;
  kernelVersion: string;
}

/** 应用构建信息 */
export interface AppInfo {
  version: string;
  tauriVersion: string;
  commitHash?: string;
  buildTime?: string;
}
