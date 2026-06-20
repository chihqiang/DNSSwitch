import { ErrorBoundary } from '@/components/common'
import { Settings } from '@/components/Settings'
import { useConfig } from '@/hooks'

export function SettingsPage() {
  const { saveConfig } = useConfig()

  return (
    <ErrorBoundary>
      <Settings onSave={saveConfig} />
    </ErrorBoundary>
  )
}
