import { Suspense, useEffect } from 'react'
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
import { useDnsStore } from '@/stores'
import type { DnsHealthEvent } from '@/types'

function AppContent() {
  const { loadConfig } = useConfig()
  const setHealthStatus = useDnsStore((s) => s.setHealthStatus)

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    const unlisten = listen<DnsHealthEvent>('dns-health-changed', (event) => {
      setHealthStatus(event.payload)
    })
    return () => { unlisten.then((fn) => fn()) }
  }, [setHealthStatus])

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
