'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { requestPasswordReset } from '@web/modules/auth/actions/auth.actions';
import {
  type ForgotPasswordValues,
  forgotPasswordSchema,
} from '@web/modules/auth/schemas/forgot-password.schema';

/** Requests a recovery link; always the same neutral answer (CA-22, RN-06). */
const ForgotPasswordForm = () => {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>, unknown, ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const result = await requestPasswordReset(values);
    if (result.ok) setSent(true);
  });

  if (sent) {
    return (
      <p role="status" className="rounded-medium bg-success-50 px-3 py-2 text-sm text-success-700">
        {t('forgotPassword.sent')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Input
        {...register('email')}
        type="email"
        label={t('forgotPassword.email')}
        autoComplete="email"
        validationBehavior="aria"
        isInvalid={!!errors.email}
        errorMessage={errors.email?.message && t(`validation.${errors.email.message}`)}
      />
      <Button type="submit" color="primary" isLoading={isSubmitting}>
        {t('forgotPassword.submit')}
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
