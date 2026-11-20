'use client';

import { useEffect, useState } from 'react';

import { env } from '@web/modules/core/config/env.config';
import { VERSION_CHECK_MS, VERSION_URL } from '@web/modules/pwa/constants/pwa.constants';
import useConnection from '@web/modules/pwa/hooks/connection.hook';

/**
 * Whether a newer version of the app is live than the one open (spec 006, HU-04): asks
 * /api/version when the person comes back to the window and every 5 minutes (CA-15). It only
 * tells; reloading is the person's choice (CA-17, RN-03). Without network it asks nothing.
 */
const useNewVersion = (buildVersion: string = env.NEXT_PUBLIC_APP_VERSION) => {
  const online = useConnection() === 'online';
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!online || isNew) return;

    const check = async () => {
      try {
        const response = await fetch(VERSION_URL, { cache: 'no-store' });
        if (!response.ok) return;
        const { version } = (await response.json()) as { version?: string };
        if (version && version !== buildVersion) setIsNew(true);
      } catch {
        // No answer: nothing to tell. The «Sin conexión» notice handles a dropped network.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };

    const timer = setInterval(check, VERSION_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [online, isNew, buildVersion]);

  return isNew;
};

export default useNewVersion;
