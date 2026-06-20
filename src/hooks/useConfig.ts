import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useConfigStore } from '@/stores'
import type { AppConfig } from '@/types'

export function useConfig() {
  const { config, isLoaded, isSaving, error, setConfig, setIsLoaded, setIsSaving, setError } =
    useConfigStore()

  const loadConfig = useCallback(async () => {
    try {
      const result = await invoke<AppConfig>('load_config')
      setConfig(result)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsLoaded(true)
    }
  }, [setConfig, setError, setIsLoaded])

  const saveConfig = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      await invoke('save_config', { config })
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsSaving(false)
    }
  }, [config, setIsSaving, setError])

  return {
    config,
    isLoaded,
    isSaving,
    error,
    loadConfig,
    saveConfig,
  }
}
