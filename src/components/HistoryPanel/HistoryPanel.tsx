import { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useTranslation } from 'react-i18next'
import { Card, Button, ButtonVariant } from '@/components/common'
import type { DnsEvent } from '@/types'

export function HistoryPanel() {
  const { t } = useTranslation()
  const [events, setEvents] = useState<DnsEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await invoke<DnsEvent[]>('get_history')
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const handleClear = async () => {
    await invoke('clear_history')
    setEvents([])
  }

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('history.title')}</h2>
        {events.length > 0 && (
          <Button variant={ButtonVariant.GHOST} size="sm" onClick={handleClear}>
            {t('history.clear')}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-text-muted">{t('common.loading')}</p>}

      {!isLoading && events.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">{t('history.empty')}</p>
      )}

      {!isLoading && events.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
          {events.map((evt) => (
            <div key={evt.id} className="flex flex-col gap-1 px-2.5 py-2 bg-bg-secondary rounded text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{evt.serverName}</span>
                <span className="text-text-muted">
                  {new Date(evt.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <span className={`${evt.success ? 'text-success' : 'text-danger'}`}>
                  {evt.success ? t('history.success') : t('history.failed')}
                </span>
                {evt.latencyMs !== undefined && (
                  <span>{Math.round(evt.latencyMs)}ms</span>
                )}
                <span>{evt.addresses.join(', ')}</span>
              </div>
              {evt.detail && <span className="text-text-muted">{evt.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
