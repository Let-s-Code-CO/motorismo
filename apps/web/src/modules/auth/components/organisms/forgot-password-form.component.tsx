'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, MailCheck } from 'lucide-react';
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
      <div
        role="status"
        className="flex items-start gap-3 rounded-large border border-success-200 bg-success-50 p-4 text-sm text-success-800"
      >
        <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>{t('forgotPassword.sent')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <Input
        {...register('email')}
        type="email"
        label={t('forgotPassword.email')}
        placeholder={t('forgotPassword.emailPlaceholder')}
        autoComplete="email"
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.email}
        errorMessage={errors.email?.message && t(`validation.${errors.email.message}`)}
      />
      <Button
        type="submit"
        color="primary"
        size="lg"
        className="font-medium"
        isLoading={isSubmitting}
      >
        {t('forgotPassword.submit')}
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
