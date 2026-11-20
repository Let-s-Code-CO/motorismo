'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@heroui/react';

import { signInWithGoogle } from '@web/modules/auth/actions/auth.actions';
import GoogleLogo from '@web/modules/auth/components/atoms/google-logo.component';
import type { AuthErrorKey } from '@web/modules/auth/utils/auth-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

/**
 * "Continuar con Google" (HU-06). Staff enter with their account; an unknown Google account
 * becomes a customer (spec 004, CA-20), so the notice of the data-processing consent goes with it.
 */
const GoogleButton = ({ next }: { next?: string }) => {
  const t = useTranslations('auth');
  const [error, setError] = useState<AuthErrorKey>();
  const [isPending, startTransition] = useTransition();

  const onPress = () =>
    startTransition(async () => {
      // On success the action redirects to Google and never returns.
      const result = await callAction(() => signInWithGoogle(next));
      // null: no network (spec 006, CA-10), the app-wide notice speaks.
      if (result && !result.ok) setError(result.error);
    });

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="bordered"
        size="lg"
        className="font-medium"
        isLoading={isPending}
        startContent={isPending ? null : <GoogleLogo />}
        onPress={onPress}
      >
        {t('login.google')}
      </Button>
      {error && <p className="text-sm text-danger">{t(`errors.${error}`)}</p>}
      <p className="text-center text-xs text-default-500">
        {t.rich('login.googleConsent', {
          link: (chunks) => (
            <Link
              href="/privacy"
              target="_blank"
              className="font-medium text-default-700 underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
};

export default GoogleButton;
