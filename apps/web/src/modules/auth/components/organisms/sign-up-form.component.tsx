'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Alert, Button, Checkbox, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Mail, MailCheck, Phone, User } from 'lucide-react';

import { signUp } from '@web/modules/auth/actions/auth.actions';
import GoogleButton from '@web/modules/auth/components/molecules/google-button.component';
import PasswordInput from '@web/modules/auth/components/molecules/password-input.component';
import {
  type SignUpInput,
  type SignUpValues,
  signUpSchema,
} from '@web/modules/auth/schemas/sign-up.schema';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type ServerError = 'rateLimited' | 'generic';

/**
 * Customer sign-up (spec 004, HU-01): name, email, optional phone, password and the
 * data-processing consent (CA-01). Afterwards the person is asked to confirm their email (CA-02);
 * the answer is the same whether or not the email already had an account (CA-07).
 */
const SignUpForm = () => {
  const t = useTranslations('auth');
  const [sentTo, setSentTo] = useState<string>();
  const [serverError, setServerError] = useState<ServerError>();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() => signUp(values));
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) setSentTo(values.email);
    else setServerError(result.error === 'rateLimited' ? 'rateLimited' : 'generic');
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6">
        <div
          role="status"
          className="flex flex-col gap-3 rounded-large border border-success-200 bg-success-50 p-5 text-success-800"
        >
          <span className="flex items-center gap-2 font-semibold">
            <MailCheck aria-hidden className="size-5 shrink-0" />
            {t('signUp.sentTitle')}
          </span>
          <p className="text-sm">{t('signUp.sent')}</p>
          <p className="text-sm">{t('signUp.sentTo', { email: sentTo })}</p>
        </div>
        <Link
          href="/auth/login"
          className="text-sm font-medium text-default-600 underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('signUp.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
        <Input
          {...register('full_name')}
          label={t('signUp.fullName')}
          placeholder={t('signUp.fullNamePlaceholder')}
          autoComplete="name"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          startContent={<User aria-hidden className="size-4 shrink-0 text-default-400" />}
          isInvalid={!!errors.full_name}
          errorMessage={fieldError(errors.full_name?.message)}
        />
        <Input
          {...register('email')}
          type="email"
          label={t('signUp.email')}
          placeholder={t('signUp.emailPlaceholder')}
          autoComplete="email"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
          isInvalid={!!errors.email}
          errorMessage={fieldError(errors.email?.message)}
        />
        <Input
          {...register('phone')}
          type="tel"
          inputMode="tel"
          label={t('signUp.phone')}
          placeholder={t('signUp.phonePlaceholder')}
          autoComplete="tel-national"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          startContent={<Phone aria-hidden className="size-4 shrink-0 text-default-400" />}
          isInvalid={!!errors.phone}
          errorMessage={fieldError(errors.phone?.message)}
        />
        <PasswordInput
          {...register('password')}
          label={t('signUp.password')}
          placeholder={t('signUp.passwordPlaceholder')}
          autoComplete="new-password"
          isInvalid={!!errors.password}
          errorMessage={fieldError(errors.password?.message)}
        />
        <Controller
          control={control}
          name="data_consent"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <Checkbox
                name={field.name}
                isSelected={field.value === true}
                onValueChange={(checked) => field.onChange(checked ? true : undefined)}
                onBlur={field.onBlur}
                size="sm"
                isInvalid={!!errors.data_consent}
                aria-describedby={errors.data_consent ? 'data-consent-error' : undefined}
                classNames={{ label: 'text-sm text-default-600' }}
              >
                {t.rich('signUp.consent', {
                  link: (chunks) => (
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </Checkbox>
              {errors.data_consent?.message && (
                <p id="data-consent-error" className="text-tiny text-danger">
                  {fieldError(errors.data_consent.message)}
                </p>
              )}
            </div>
          )}
        />
        <Button
          type="submit"
          color="primary"
          size="lg"
          className="font-medium"
          isLoading={isSubmitting}
          endContent={isSubmitting ? null : <ArrowRight aria-hidden className="size-4" />}
        >
          {t('signUp.submit')}
        </Button>
      </form>
      <div className="flex items-center gap-3 text-xs tracking-wider text-default-500 uppercase">
        <span className="h-px flex-1 bg-divider" />
        {t('login.or')}
        <span className="h-px flex-1 bg-divider" />
      </div>
      {/* Spec 004, CA-20: an unknown Google account becomes a customer account. */}
      <GoogleButton />
      <p className="text-center text-sm text-default-500">
        {t('signUp.haveAccount')}{' '}
        <Link
          href="/auth/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t('signUp.signIn')}
        </Link>
      </p>
    </div>
  );
};

export default SignUpForm;
