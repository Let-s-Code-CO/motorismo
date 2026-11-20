'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Button, Tooltip } from '@heroui/react';
import { MonitorSmartphone } from 'lucide-react';

import IosInstallSteps from '@web/modules/pwa/components/ios-install-steps.component';
import useInstallPrompt from '@web/modules/pwa/hooks/install-prompt.hook';
import { promptInstall } from '@web/modules/pwa/utils/install-prompt.lib';

/**
 * «Instalar app», next to the account in the header (spec 006, HU-03): asks the browser to install
 * the app (CA-12) or, on an iPhone or iPad, shows the steps (CA-13). Not drawn once the app is
 * installed or where it cannot be installed (CA-14).
 */
const InstallAppButton = () => {
  const t = useTranslations('pwa.install');
  const option = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (!option) return null;

  return (
    <>
      <Tooltip content={t('label')} placement="bottom">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label={t('label')}
          onPress={() => (option === 'ios' ? setShowSteps(true) : void promptInstall())}
        >
          <MonitorSmartphone aria-hidden className="size-4" />
        </Button>
      </Tooltip>
      <IosInstallSteps isOpen={showSteps} onClose={() => setShowSteps(false)} />
    </>
  );
};

export default InstallAppButton;
