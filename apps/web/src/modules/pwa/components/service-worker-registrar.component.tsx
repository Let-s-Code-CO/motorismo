'use client';

import { useEffect } from 'react';

import { SERVICE_WORKER_URL } from '@web/modules/pwa/constants/pwa.constants';

/**
 * Registers the service worker that shows the "Sin conexión" page (spec 006, CA-09). In every
 * environment, also in development (the E2E suite runs against `pnpm dev`): it caches nothing of
 * the app, so it never serves stale code. `updateViaCache: 'none'` always fetches the latest one.
 */
const ServiceWorkerRegistrar = () => {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Without it the app still works; only the "Sin conexión" page is missing.
      });
  }, []);

  return null;
};

export default ServiceWorkerRegistrar;
