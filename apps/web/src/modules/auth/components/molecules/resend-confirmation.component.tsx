'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@heroui/react';
import { MailCheck } from 'lucide-react';

import { resendConfirmation } from '@web/modules/auth/actions/auth.actions';

type ResendConfirmationProps = {
  /** Reads the email to use at the moment of pressing (e.g. from the login form). */
  getEmail: () => string;
};

/**
 * "Reenviar correo de confirmación" (spec 004, CA-04 / CA-05). Always the same neutral answer, so
 * it reveals nothing about which emails have a pending sign-up (RN-06).
 */
const ResendConfirmation = ({ getEmail }: ResendConfirmationProps) => {
  const t = useTranslations('auth.login');
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (sent) {
    return (
      <p role="status" className="flex items-start gap-2 text-sm text-success-700">
        <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('resent')}
      </p>
    );
  }

  return (
    <Button
      variant="flat"
      size="sm"
      className="self-start font-medium"
      isLoading={isPending}
      onPress={() =>
        startTransition(async () => {
          await resendConfirmation(getEmail());
          setSent(true);
        })
      }
    >
      {t('resend')}
    </Button>
  );
};

export default ResendConfirmation;
