import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DnsServer } from '@/types'
import { DnsProviderKey, DnsProviderInfo, DnsServerTag } from '@/types'
import { Button, ButtonVariant } from '@/components/common'
import { inputClass, LABEL_CLASS, ERROR_CLASS } from '@/components/common/forms'

const TAG_OPTIONS = [
  DnsServerTag.PUBLIC,
  DnsServerTag.PRIVACY,
  DnsServerTag.FAST,
  DnsServerTag.SECURITY,
  DnsServerTag.FAMILY,
]

function isValidIp(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/
  if (ipv4.test(ip)) {
    return ip.split('.').every((o) => {
      const n = Number(o)
      return n >= 0 && n <= 255
    })
  }
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/
  return ipv6.test(ip)
}

interface AddServerFormProps {
  editingServer?: DnsServer | null
  onSubmit: (server: DnsServer) => void
  onCancel: () => void
}

export function AddServerForm({ editingServer, onSubmit, onCancel }: AddServerFormProps) {
  const { t } = useTranslation()
  const isEditing = !!editingServer

  const [name, setName] = useState(editingServer?.name ?? '')
  const [primaryAddr, setPrimaryAddr] = useState(editingServer?.addresses[0] ?? '')
  const [secondaryAddr, setSecondaryAddr] = useState(editingServer?.addresses[1] ?? '')
  const [selectedTags, setSelectedTags] = useState<DnsServerTag[]>(editingServer?.tags ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})

  function toggleTag(tag: DnsServerTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function reset() {
    setName('')
    setPrimaryAddr('')
    setSecondaryAddr('')
    setSelectedTags([])
    setErrors({})
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('server.name_required')
    if (!primaryAddr.trim()) errs.address = t('server.address_required')
    else if (!isValidIp(primaryAddr.trim())) errs.address = t('server.address_invalid')
    if (secondaryAddr.trim() && !isValidIp(secondaryAddr.trim())) {
      errs.secondaryAddress = t('server.address_invalid')
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const addresses = [primaryAddr.trim()]
    if (secondaryAddr.trim()) addresses.push(secondaryAddr.trim())

    const now = Date.now()
    const server: DnsServer = {
      id: editingServer?.id ?? `custom-${now}`,
      name: name.trim(),
      addresses,
      provider: editingServer?.provider ?? DnsProviderInfo[DnsProviderKey.CUSTOM],
      isActive: editingServer?.isActive ?? false,
      isSystem: editingServer?.isSystem ?? false,
      tags: selectedTags,
      createdAt: editingServer?.createdAt ?? now,
      updatedAt: now,
      latency: editingServer?.latency,
    }

    onSubmit(server)
    if (!isEditing) reset()
  }

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('server.name')}</label>
        <input
          className={inputClass(errors.name)}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('server.name_placeholder')}
          autoFocus
        />
        {errors.name && <span className={ERROR_CLASS}>{errors.name}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('server.address')}</label>
        <input
          className={inputClass(errors.address)}
          type="text"
          value={primaryAddr}
          onChange={(e) => setPrimaryAddr(e.target.value)}
          placeholder={t('server.address_placeholder')}
        />
        {errors.address && <span className={ERROR_CLASS}>{errors.address}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('server.secondary_address')}</label>
        <input
          className={inputClass(errors.secondaryAddress)}
          type="text"
          value={secondaryAddr}
          onChange={(e) => setSecondaryAddr(e.target.value)}
          placeholder={t('server.secondary_address_placeholder')}
        />
        {errors.secondaryAddress && <span className={ERROR_CLASS}>{errors.secondaryAddress}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>{t('server.tags')}</label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => (
            <label key={tag} className="flex items-center gap-1.5 text-xs cursor-pointer text-text-primary px-2 py-1 rounded bg-bg-secondary hover:bg-border transition-colors duration-150">
              <input
                type="checkbox"
                className="accent-accent"
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              <span>{t(`tag.${tag}`)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button type="button" variant={ButtonVariant.SECONDARY} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant={ButtonVariant.PRIMARY}>
          {isEditing ? t('common.save') : t('common.add')}
        </Button>
      </div>
    </form>
  )
}
