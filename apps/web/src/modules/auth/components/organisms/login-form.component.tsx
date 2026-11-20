'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail } from 'lucide-react';
import type { z } from 'zod';

import { signIn } from '@web/modules/auth/actions/auth.actions';
import GoogleButton from '@web/modules/auth/components/molecules/google-button.component';
import PasswordInput from '@web/modules/auth/components/molecules/password-input.component';
import ResendConfirmation from '@web/modules/auth/components/molecules/resend-confirmation.component';
import { type LoginValues, loginSchema } from '@web/modules/auth/schemas/login.schema';
import type { AuthErrorKey } from '@web/modules/auth/utils/auth-errors.utils';
import BrandMoment from '@web/modules/core/components/brand-moment.component';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type LoginFormProps = {
  /** Page to return to after signing in (CA-03); already sanitized by the page. */
  next?: string;
  /** Message passed by the proxy, e.g. account disabled (CA-06). */
  initialError?: AuthErrorKey;
};

const LoginForm = ({ next, initialError }: LoginFormProps) => {
  const t = useTranslations('auth');
  const [serverError, setServerError] = useState<AuthErrorKey | undefined>(initialError);
  const router = useRouter();
  // Signed in, on the way in: the brand shows until the destination replaces this page (spec 011,
  // CA-12). Only after the server said the credentials are right, never while it checks them.
  const [entering, startEntering] = useTransition();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() => signIn(values, next));
    // null: no network (spec 006, CA-10), the app-wide notice speaks.
    if (!result) return;
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    // The server chose the destination (spec 004, RF-02); go there showing the brand meanwhile.
    startEntering(() => router.replace(result.destination));
  });

  return (
    <div className="flex flex-col gap-6">
      {entering && <BrandMoment />}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {serverError && (
          <Alert
            color={serverError === 'emailNotConfirmed' ? 'warning' : 'danger'}
            variant="faded"
            title={t(`errors.${serverError}`)}
          >
            {/* Spec 004, CA-04: a new confirmation email for the typed address. */}
            {serverError === 'emailNotConfirmed' && (
              <div className="mt-2">
                <ResendConfirmation getEmail={() => getValues('email')} />
              </div>
            )}
          </Alert>
        )}
        <Input
          {...register('email')}
          type="email"
          label={t('login.email')}
          placeholder={t('login.emailPlaceholder')}
          autoComplete="email"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
          isInvalid={!!errors.email}
          errorMessage={errors.email?.message && t(`validation.${errors.email.message}`)}
        />
        <div className="flex flex-col gap-2">
          <PasswordInput
            {...register('password')}
            label={t('login.password')}
            placeholder={t('login.passwordPlaceholder')}
            autoComplete="current-password"
            isInvalid={!!errors.password}
            errorMessage={errors.password?.message && t(`validation.${errors.password.message}`)}
          />
          <Link
            href="/auth/forgot-password"
            className="self-end text-sm font-medium text-default-600 underline-offset-4 hover:text-foreground hover:underline"
          >
            {t('login.forgot')}
          </Link>
        </div>
        <Button
          type="submit"
          color="primary"
          size="lg"
          className="font-medium"
          isLoading={isSubmitting}
          endContent={isSubmitting ? null : <ArrowRight aria-hidden className="size-4" />}
        >
          {t('login.submit')}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-default-500">
        <span className="h-px flex-1 bg-divider" />
        {t('login.or')}
        <span className="h-px flex-1 bg-divider" />
      </div>
      <GoogleButton next={next} />
      <p className="text-center text-sm text-default-500">
        {t('login.noAccount')}{' '}
        <Link
          href="/auth/sign-up"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t('login.signUp')}
        </Link>
      </p>
    </div>
  );
};

export default LoginForm;
