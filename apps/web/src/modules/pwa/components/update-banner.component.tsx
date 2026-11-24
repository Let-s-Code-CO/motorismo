'use client';

import { useTranslations } from 'next-intl';

import { Alert, Button } from '@heroui/react';

import useBottomBanner from '@web/modules/core/hooks/bottom-banner.hook';
import useConnection from '@web/modules/pwa/hooks/connection.hook';
import useHasNewVersion from '@web/modules/pwa/hooks/has-new-version.hook';
import { reloadPage } from '@web/modules/pwa/utils/reload.utils';

/**
 * «Hay una versión nueva» with «Actualizar» (spec 006, HU-04): shown when a new version is live
 * (CA-15); «Actualizar» loads it on the same page (CA-16). The app never reloads by itself, so
 * whatever is being typed stays until the person decides (CA-17, RN-03). Without network the
 * «Sin conexión» notice speaks alone.
 */
const UpdateBanner = () => {
  const t = useTranslations('pwa.update');
  // Spec 013: the floating notices rise above this banner instead of covering it.
  const makeRoom = useBottomBanner();
  const isNew = useHasNewVersion();
  const online = useConnection() === 'online';

  if (!isNew || !online) return null;

  return (
    // An opaque background under the faded (translucent) alert: in dark mode the page would show
    // through.
    <div
      ref={makeRoom}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-medium bg-content1 shadow-large"
    >
      <Alert
        color="default"
        variant="faded"
        title={t('title')}
        description={t('description')}
        endContent={
          <Button color="primary" size="sm" className="font-medium" onPress={reloadPage}>
            {t('action')}
          </Button>
        }
      />
    </div>
  );
};

export default UpdateBanner;
