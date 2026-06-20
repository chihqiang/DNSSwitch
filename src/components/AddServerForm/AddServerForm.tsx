import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { DnsServer, DnsLatencyTest } from '@/types';
import { DnsProviderKey, DnsProviderInfo } from '@/types';
import { Button, ButtonVariant } from '@/components/common';
import { inputClass, LABEL_CLASS, ERROR_CLASS } from '@/components/common/forms';

function isValidIp(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split('.').every((o) => {
      const n = Number(o);
      return n >= 0 && n <= 255;
    });
  }
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6.test(ip);
}

interface AddServerFormProps {
  editingServer?: DnsServer | null;
  onSubmit: (server: DnsServer) => void;
  onCancel: () => void;
}

export function AddServerForm({ editingServer, onSubmit, onCancel }: AddServerFormProps) {
  const { t } = useTranslation();
  const isEditing = !!editingServer;

  const [name, setName] = useState(editingServer?.name ?? '');
  const [primaryAddr, setPrimaryAddr] = useState(editingServer?.addresses[0] ?? '');
  const [secondaryAddr, setSecondaryAddr] = useState(editingServer?.addresses[1] ?? '');
  const [dohUrl, setDohUrl] = useState(editingServer?.dohUrl ?? '');
  const [dotAddress, setDotAddress] = useState(editingServer?.dotAddress ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<DnsLatencyTest | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  function reset() {
    setName('');
    setPrimaryAddr('');
    setSecondaryAddr('');
    setErrors({});
  }

  const hasAddr = primaryAddr.trim().length > 0;
  const hasDoh = dohUrl.trim().length > 0;
  const hasDot = dotAddress.trim().length > 0;

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t('server.name_required');
    if (!hasAddr && !hasDoh && !hasDot) {
      errs.address = t('server.address_or_doh_required');
    }
    if (hasAddr && !isValidIp(primaryAddr.trim())) errs.address = t('server.address_invalid');
    if (secondaryAddr.trim() && !isValidIp(secondaryAddr.trim())) {
      errs.secondaryAddress = t('server.address_invalid');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleTest = useCallback(async () => {
    const addr = primaryAddr.trim();
    if (!addr || !isValidIp(addr)) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await invoke<DnsLatencyTest>('test_dns_latency', {
        serverId: 'test',
        address: addr,
      });
      setTestResult(result);
    } catch {
      setTestResult({
        serverId: 'test',
        address: addr,
        latencyMs: 0,
        success: false,
        error: 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  }, [primaryAddr]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const addresses: string[] = [];
    if (primaryAddr.trim()) addresses.push(primaryAddr.trim());
    if (secondaryAddr.trim()) addresses.push(secondaryAddr.trim());

    const now = Date.now();
    const server: DnsServer = {
      id: editingServer?.id ?? `custom-${now}`,
      name: name.trim(),
      addresses,
      provider: editingServer?.provider ?? DnsProviderInfo[DnsProviderKey.CUSTOM],
      isActive: editingServer?.isActive ?? false,
      isSystem: editingServer?.isSystem ?? false,
      tags: [],
      dohUrl: dohUrl.trim() || undefined,
      dotAddress: dotAddress.trim() || undefined,
      createdAt: editingServer?.createdAt ?? now,
      updatedAt: now,
      latency: editingServer?.latency,
    };

    onSubmit(server);
    if (!isEditing) reset();
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
        <label className={LABEL_CLASS}>DoH URL</label>
        <input
          className={inputClass()}
          type="text"
          value={dohUrl}
          onChange={(e) => setDohUrl(e.target.value)}
          placeholder="https://dns.example.com/dns-query"
        />
        <span className="text-xs text-text-muted">{t('server.doh_hint')}</span>
      </div>

      <div className="flex flex-col gap-1">
        <label className={LABEL_CLASS}>DoT Address</label>
        <input
          className={inputClass()}
          type="text"
          value={dotAddress}
          onChange={(e) => setDotAddress(e.target.value)}
          placeholder="1.1.1.1"
        />
        <span className="text-xs text-text-muted">{t('server.dot_hint')}</span>
      </div>

      {testResult && (
        <div
          className={`px-3 py-2 rounded text-xs ${testResult.success ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}
        >
          {testResult.success ? `Reachable - ${Math.round(testResult.latencyMs)}ms` : testResult.error || 'Unreachable'}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button type="button" variant={ButtonVariant.SECONDARY} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant={ButtonVariant.GHOST}
          size="sm"
          onClick={handleTest}
          isLoading={isTesting}
          disabled={!primaryAddr.trim() || !isValidIp(primaryAddr.trim())}
        >
          Test
        </Button>
        <Button type="submit" variant={ButtonVariant.PRIMARY}>
          {isEditing ? t('common.save') : t('common.add')}
        </Button>
      </div>
    </form>
  );
}
