'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { Check, Share, SquarePlus } from 'lucide-react';

type IosInstallStepsProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * On an iPhone or iPad the browser cannot install the app itself: these are the steps to add it
 * to the home screen from Safari (spec 006, CA-13).
 */
const IosInstallSteps = ({ isOpen, onClose }: IosInstallStepsProps) => {
  const t = useTranslations('pwa.install');
  const steps = [
    { icon: Share, text: t('iosStep1') },
    { icon: SquarePlus, text: t('iosStep2') },
    { icon: Check, text: t('iosStep3') },
  ];

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} placement="center">
      <ModalContent>
        <ModalHeader>{t('iosTitle')}</ModalHeader>
        <ModalBody className="gap-4">
          <p className="text-sm text-default-500">{t('iosIntro')}</p>
          <ol className="flex flex-col gap-3">
            {steps.map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-start gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-default-100 text-default-700">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="pt-1.5">
                  <span className="sr-only">{index + 1}. </span>
                  {text}
                </span>
              </li>
            ))}
          </ol>
        </ModalBody>
        <ModalFooter>
          <Button color="primary" className="font-medium" onPress={onClose}>
            {t('close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default IosInstallSteps;
