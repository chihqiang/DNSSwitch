import { Suspense, useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout/Layout'
import { ServersPage } from '@/pages/ServersPage'
import { QueryPage } from '@/pages/QueryPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LogPage } from '@/pages/LogPage'
import { StatusBar } from '@/components/StatusBar'
import { useConfig } from '@/hooks'

function AppContent() {
  const { loadConfig } = useConfig()

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

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
    <Suspense fallback={null}>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </Suspense>
  )
}

export default App
