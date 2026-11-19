'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

import { setPassword } from '@web/modules/auth/actions/auth.actions';
import {
  type SetPasswordValues,
  setPasswordSchema,
} from '@web/modules/auth/schemas/set-password.schema';
import type { AuthErrorKey } from '@web/modules/auth/utils/auth-errors.utils';

/** New password for an invited user (CA-14) or after a recovery link (CA-23). RN-04. */
const SetPasswordForm = () => {
  const t = useTranslations('auth');
  const [serverError, setServerError] = useState<AuthErrorKey>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof setPasswordSchema>, unknown, SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await setPassword(values);
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
        {...register('password')}
        type="password"
        label={t('setPassword.password')}
        description={t('setPassword.hint')}
        autoComplete="new-password"
        validationBehavior="aria"
        isInvalid={!!errors.password}
        errorMessage={errors.password?.message && t(`validation.${errors.password.message}`)}
      />
      <Input
        {...register('confirm')}
        type="password"
        label={t('setPassword.confirm')}
        autoComplete="new-password"
        validationBehavior="aria"
        isInvalid={!!errors.confirm}
        errorMessage={errors.confirm?.message && t(`validation.${errors.confirm.message}`)}
      />
      <Button type="submit" color="primary" isLoading={isSubmitting}>
        {t('setPassword.submit')}
      </Button>
    </form>
  );
};

export default SetPasswordForm;
