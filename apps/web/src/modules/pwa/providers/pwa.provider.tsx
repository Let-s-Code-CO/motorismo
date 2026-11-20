'use client';

import type { ReactNode } from 'react';

import ConnectionGate from '@web/modules/pwa/components/connection-gate.component';
import ServiceWorkerRegistrar from '@web/modules/pwa/components/service-worker-registrar.component';
import UpdateBanner from '@web/modules/pwa/components/update-banner.component';
import useNewVersion from '@web/modules/pwa/hooks/app-version.hook';
import { NewVersionContext } from '@web/modules/pwa/hooks/has-new-version.hook';
// Listens for the browser's install offer from the first script (spec 006, CA-12).
import '@web/modules/pwa/utils/install-prompt.lib';

/**
 * The installable app on every page (spec 006): the service worker, the «Sin conexión» gate
 * (HU-02) and the new-version notice (HU-04). The version is checked once here and shared, so the
 * install notice (HU-03, in the signed-in area) can give way to it (CA-20).
 */
const PwaProvider = ({ children }: { children: ReactNode }) => {
  const hasNewVersion = useNewVersion();

  return (
    <NewVersionContext.Provider value={hasNewVersion}>
      {children}
      <ConnectionGate />
      <UpdateBanner />
      <ServiceWorkerRegistrar />
    </NewVersionContext.Provider>
  );
};

export default PwaProvider;
