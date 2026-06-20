import { Suspense, useEffect, useCallback } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { listen } from '@tauri-apps/api/event'
import { Layout } from '@/components/Layout/Layout'
import { ServersPage } from '@/pages/ServersPage'
import { QueryPage } from '@/pages/QueryPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LogPage } from '@/pages/LogPage'
import { StatusBar } from '@/components/StatusBar'
import { ErrorBoundary, LoadingSpinner } from '@/components/common'
import { useConfig } from '@/hooks'
import { useDnsStore, useScheduleStore } from '@/stores'
import type { DnsHealthEvent, ScheduleEventPayload } from '@/types'

function AppContent() {
  const { loadConfig } = useConfig()
  const setHealthStatus = useDnsStore((s) => s.setHealthStatus)
  const showToast = useScheduleStore((s) => s.showToast)
  const toast = useScheduleStore((s) => s.toast)
  const clearToast = useScheduleStore((s) => s.clearToast)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const unlisten = listen<DnsHealthEvent>('dns-health-changed', (event) => {
      setHealthStatus(event.payload)
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [setHealthStatus])

  useEffect(() => {
    const unlisten = listen<ScheduleEventPayload>('schedule-event', (event) => {
      showToast(event.payload)
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [showToast])

  const handleToastClick = useCallback(() => {
    clearToast()
  }, [clearToast])

  return (
    <div className="flex flex-col min-h-screen">
      <Routes>
        <Route element={<Layout />}>
          <Route path="/servers" element={<ServersPage />} />
          <Route path="/query" element={<QueryPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/log" element={<LogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/servers" replace />} />
        </Route>
      </Routes>
      <StatusBar />
      {toast && (
        <div
          className={`fixed bottom-16 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm cursor-pointer select-none animate-fadeIn ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
          onClick={handleToastClick}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size={24} /></div>}>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
