'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { signIn } from '@web/modules/auth/actions/auth.actions';
import GoogleButton from '@web/modules/auth/components/molecules/google-button.component';
import { type LoginValues, loginSchema } from '@web/modules/auth/schemas/login.schema';
import type { AuthErrorKey } from '@web/modules/auth/utils/auth-errors.utils';

type LoginFormProps = {
  /** Page to return to after signing in (CA-03); already sanitized by the page. */
  next?: string;
  /** Message passed by the proxy, e.g. account disabled (CA-06). */
  initialError?: AuthErrorKey;
};

const LoginForm = ({ next, initialError }: LoginFormProps) => {
  const t = useTranslations('auth');
  const [serverError, setServerError] = useState<AuthErrorKey | undefined>(initialError);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof loginSchema>, unknown, LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // On success the action redirects and never returns.
    const result = await signIn(values, next);
    if (result && !result.ok) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError && (
        <p role="alert" className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
          {t(`errors.${serverError}`)}
        </p>
      )}
      <Input
        {...register('email')}
        type="email"
        label={t('login.email')}
        autoComplete="email"
        validationBehavior="aria"
        isInvalid={!!errors.email}
        errorMessage={errors.email?.message && t(`validation.${errors.email.message}`)}
      />
      <Input
        {...register('password')}
        type="password"
        label={t('login.password')}
        autoComplete="current-password"
        validationBehavior="aria"
        isInvalid={!!errors.password}
        errorMessage={errors.password?.message && t(`validation.${errors.password.message}`)}
      />
      <Button type="submit" color="primary" isLoading={isSubmitting}>
        {t('login.submit')}
      </Button>
      <Link href="/auth/forgot-password" className="text-center text-sm text-primary underline">
        {t('login.forgot')}
      </Link>
      <div className="flex items-center gap-3 text-xs text-default-400">
        <span className="h-px flex-1 bg-divider" />
        {t('login.or')}
        <span className="h-px flex-1 bg-divider" />
      </div>
      <GoogleButton next={next} />
    </form>
  );
};

export default LoginForm;
