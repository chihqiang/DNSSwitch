import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useDnsStore, useConfigStore } from '@/stores'
import { PRESET_SERVERS } from '@/types'
import type { DnsServer, DnsLatencyTest } from '@/types'

export function useDnsServers() {
  const { servers, setServers, addServer, removeServer, updateServer, addLatencyTest } =
    useDnsStore()
  const { config, isLoaded, setConfig } = useConfigStore()

  const loadServers = useCallback(() => {
    if (!isLoaded) return
    if (config.servers.length > 0) {
      setServers(config.servers)
    } else {
      setServers(PRESET_SERVERS)
    }
  }, [config.servers, isLoaded, setServers])

  const addCustomServer = useCallback(
    async (server: DnsServer) => {
      addServer(server)
      setConfig({
        ...config,
        servers: [...config.servers, server],
      })
    },
    [addServer, config, setConfig]
  )

  const deleteServer = useCallback(
    async (id: string) => {
      removeServer(id)
      setConfig({
        ...config,
        servers: config.servers.filter((s) => s.id !== id),
      })
    },
    [removeServer, config, setConfig]
  )

  const editServer = useCallback(
    async (id: string, updates: Partial<DnsServer>) => {
      updateServer(id, updates)
      setConfig({
        ...config,
        servers: config.servers.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })
    },
    [updateServer, config, setConfig]
  )

  const refreshLatency = useCallback(async () => {
    const results = await Promise.allSettled(
      servers
        .filter((s) => s.addresses.length > 0)
        .map((server) =>
          invoke<DnsLatencyTest>('test_dns_latency', {
            serverId: server.id,
            address: server.addresses[0],
          })
        )
    )
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        updateServer(result.value.serverId, { latency: result.value.latencyMs })
        addLatencyTest(result.value)
      }
    }
  }, [servers, updateServer, addLatencyTest])

  useEffect(() => {
    loadServers()
  }, [loadServers])

  return {
    servers,
    addCustomServer,
    deleteServer,
    editServer,
    refreshLatency,
  }
}
