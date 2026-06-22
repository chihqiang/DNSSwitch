import { useEffect } from 'react';
import NProgress from 'nprogress';
import { useDnsStore, useConfigStore } from '@/stores';

NProgress.configure({ showSpinner: false, minimum: 0.08, trickleSpeed: 200 });

export function useNProgress() {
  const isSwitching = useDnsStore((s) => s.isSwitching);
  const isTesting = useDnsStore((s) => s.isTesting);
  const isSaving = useConfigStore((s) => s.isSaving);

  const loading = isSwitching || isTesting || isSaving;

  useEffect(() => {
    if (loading) NProgress.start();
    else NProgress.done();
  }, [loading]);
}
