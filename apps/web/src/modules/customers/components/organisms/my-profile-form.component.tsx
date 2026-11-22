'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useFormatter, useTranslations } from 'next-intl';

import { Alert, Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, User } from 'lucide-react';

import { notify } from '@web/modules/core/lib/toast.lib';
import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { updateMyProfile } from '@web/modules/customers/actions/customers.actions';
import {
  type MyProfileInput,
  type MyProfileValues,
  myProfileSchema,
} from '@web/modules/customers/schemas/customer.schema';
import type { CustomersErrorKey } from '@web/modules/customers/utils/customers-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type MyProfileFormProps = {
  customer: { full_name: string; email: string | null; phone: string | null; created_at: string };
};

/**
 * "Mi perfil" (spec 004, HU-03): the customer sees their data (CA-12) and changes their name and
 * phone (CA-13); the email is shown read-only (CA-14, RN-10).
 */
const MyProfileForm = ({ customer }: MyProfileFormProps) => {
  const t = useTranslations('customers');
  const format = useFormatter();
  // A refusal stays inside the form, next to what to correct (spec 013, CA-08).
  const [serverError, setServerError] = useState<CustomersErrorKey>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MyProfileInput, unknown, MyProfileValues>({
    resolver: zodResolver(myProfileSchema),
    defaultValues: {
      full_name: customer.full_name,
      phone: customer.phone ? formatMobile(customer.phone) : '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() => updateMyProfile(values));
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) notify({ tone: 'success', text: t('profile.saved') });
    else setServerError(result.error);
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-sm text-default-500">
        {t('profile.since', {
          date: format.dateTime(new Date(customer.created_at), { dateStyle: 'long' }),
        })}
      </p>
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
      <Input
        {...register('full_name')}
        label={t('profile.fullName')}
        autoComplete="name"
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<User aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.full_name}
        errorMessage={fieldError(errors.full_name?.message)}
      />
      <Input
        value={customer.email ?? ''}
        isReadOnly
        label={t('profile.email')}
        description={t('profile.emailHint')}
        variant="flat"
        labelPlacement="outside"
        startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
      />
      <Input
        {...register('phone')}
        type="tel"
        inputMode="tel"
        label={t('profile.phone')}
        placeholder={t('profile.phonePlaceholder')}
        autoComplete="tel-national"
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<Phone aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.phone}
        errorMessage={fieldError(errors.phone?.message)}
      />
      <Button
        type="submit"
        color="primary"
        className="self-start font-medium"
        isLoading={isSubmitting}
      >
        {t('profile.save')}
      </Button>
    </form>
  );
};

export default MyProfileForm;
