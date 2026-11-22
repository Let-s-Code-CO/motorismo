'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Alert, Button } from '@heroui/react';
import { MonitorSmartphone } from 'lucide-react';

import useBottomBanner from '@web/modules/core/hooks/bottom-banner.hook';
import IosInstallSteps from '@web/modules/pwa/components/ios-install-steps.component';
import useConnection from '@web/modules/pwa/hooks/connection.hook';
import useHasNewVersion from '@web/modules/pwa/hooks/has-new-version.hook';
import useInstallPrompt from '@web/modules/pwa/hooks/install-prompt.hook';
import { promptInstall } from '@web/modules/pwa/utils/install-prompt.lib';
import { isInstallSnoozed, snoozeInstall } from '@web/modules/pwa/utils/install-snooze.utils';

/**
 * «Instala Motorismo en este dispositivo», floating at the bottom of the signed-in area (spec 006,
 * CA-18): «Instalar» asks the browser, or shows the steps on an iPhone or iPad; «Ahora no» hides it
 * on this device for 14 days (CA-19). Not shown once installed or where the app cannot be
 * installed (CA-14), nor while «Sin conexión» or «Hay una versión nueva» speak (CA-20).
 */
const InstallBanner = () => {
  const t = useTranslations('pwa.install');
  // Spec 013: the floating notices rise above this banner instead of covering it.
  const makeRoom = useBottomBanner();
  const option = useInstallPrompt();
  const online = useConnection() === 'online';
  const hasNewVersion = useHasNewVersion();
  const [snoozed, setSnoozed] = useState(isInstallSnoozed);
  const [showSteps, setShowSteps] = useState(false);

  if (!option || snoozed || !online || hasNewVersion) {
    return <IosInstallSteps isOpen={showSteps} onClose={() => setShowSteps(false)} />;
  }

  return (
    <>
      {/*
       * Sticky, not fixed: it floats at the bottom while scrolling, but at the end of the page it
       * takes its own room below the footer, so it never covers the last thing on a page (such as
       * «Anular orden», spec 008). It is the last child of the signed-in layout for that.
       */}
      <div
        ref={makeRoom}
        className="sticky bottom-4 z-40 mx-4 mb-4 rounded-medium shadow-large sm:mx-auto sm:w-full sm:max-w-xl"
      >
        <Alert
          color="default"
          variant="faded"
          icon={<MonitorSmartphone aria-hidden className="size-5" />}
          title={t('bannerTitle')}
          description={t('bannerDescription')}
        >
          {/* Below the text, not beside it: on a phone the text would be squeezed. */}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="light"
              onPress={() => {
                snoozeInstall();
                setSnoozed(true);
              }}
            >
              {t('bannerDismiss')}
            </Button>
            <Button
              size="sm"
              color="primary"
              className="font-medium"
              onPress={() => (option === 'ios' ? setShowSteps(true) : void promptInstall())}
            >
              {t('bannerAction')}
            </Button>
          </div>
        </Alert>
      </div>
      <IosInstallSteps isOpen={showSteps} onClose={() => setShowSteps(false)} />
    </>
  );
};

export default InstallBanner;
