export const NetworkInterfaceType = {
  WIFI: 'wifi',
  ETHERNET: 'ethernet',
  CELLULAR: 'cellular',
  VPN: 'vpn',
  OTHER: 'other',
} as const
export type NetworkInterfaceType = (typeof NetworkInterfaceType)[keyof typeof NetworkInterfaceType]

export interface NetworkService {
  name: string
  displayName: string
  isActive: boolean
  dnsServers: string[]
}

export interface NetworkInterface {
  name: string
  displayName: string
  type: NetworkInterfaceType
  isActive: boolean
  dnsServers: string[]
}

export interface SystemInfo {
  os: string
  osVersion: string
  hostname: string
  kernelVersion: string
}

export interface AppInfo {
  version: string
  tauriVersion: string
  commitHash?: string
  buildTime?: string
}
