import { Settings } from '@/components/Settings'
import { useConfig } from '@/hooks'

export function SettingsPage() {
  const { saveConfig } = useConfig()

  return <Settings onSave={saveConfig} />
}
