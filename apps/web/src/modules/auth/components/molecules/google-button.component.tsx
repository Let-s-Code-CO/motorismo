'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@heroui/react';

import { signInWithGoogle } from '@web/modules/auth/actions/auth.actions';
import GoogleLogo from '@web/modules/auth/components/atoms/google-logo.component';
import type { AuthErrorKey } from '@web/modules/auth/utils/auth-errors.utils';

/** "Continuar con Google" (HU-06). Only emails already invited by an admin get in. */
const GoogleButton = ({ next }: { next?: string }) => {
  const t = useTranslations('auth');
  const [error, setError] = useState<AuthErrorKey>();
  const [isPending, startTransition] = useTransition();

  const onPress = () =>
    startTransition(async () => {
      // On success the action redirects to Google and never returns.
      const result = await signInWithGoogle(next);
      if (result && !result.ok) setError(result.error);
    });

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="bordered"
        isLoading={isPending}
        startContent={isPending ? null : <GoogleLogo />}
        onPress={onPress}
      >
        {t('login.google')}
      </Button>
      {error && <p className="text-sm text-danger">{t(`errors.${error}`)}</p>}
    </div>
  );
};

export default GoogleButton;
