'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Alert, Button, Checkbox, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, User } from 'lucide-react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { createCustomer, updateCustomer } from '@web/modules/customers/actions/customers.actions';
import {
  type NewCustomerInput,
  type NewCustomerValues,
  editCustomerSchema,
  newCustomerSchema,
} from '@web/modules/customers/schemas/customer.schema';
import type { CustomersErrorKey } from '@web/modules/customers/utils/customers-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type Contact = { full_name: string; email: string | null; phone: string | null };

type CustomerFormProps = { onSaved: () => void; onCancel?: () => void } & (
  | { mode: 'create' }
  | {
      mode: 'edit';
      customerId: string;
      defaults: Contact;
      /** The customer has an account: their email is their login and cannot change (RN-10). */
      emailLocked: boolean;
    }
);

/**
 * Staff register a customer at the counter (spec 004, CA-24/CA-25, with the customer's consent) or
 * correct a customer's data (CA-27). The database refuses an email already in use (CA-26).
 */
const CustomerForm = (props: CustomerFormProps) => {
  const t = useTranslations('customers');
  const [serverError, setServerError] = useState<CustomersErrorKey>();
  const isCreate = props.mode === 'create';
  const emailLocked = props.mode === 'edit' && props.emailLocked;
  const defaults = props.mode === 'edit' ? props.defaults : undefined;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewCustomerInput, unknown, NewCustomerValues>({
    // In edit mode the consent was given when the customer was registered.
    resolver: zodResolver(
      (isCreate ? newCustomerSchema : editCustomerSchema) as typeof newCustomerSchema
    ),
    defaultValues: {
      full_name: defaults?.full_name ?? '',
      email: defaults?.email ?? '',
      phone: defaults?.phone ? formatMobile(defaults.phone) : '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() =>
      props.mode === 'create'
        ? createCustomer(values)
        : updateCustomer({
            id: props.customerId,
            full_name: values.full_name,
            email: values.email,
            phone: values.phone,
          })
    );
    // No network (spec 006, CA-10): the app-wide notice speaks; the form stays as it was.
    if (!result) return;
    if (result.ok) props.onSaved();
    else setServerError(result.error);
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
      <Input
        {...register('full_name')}
        label={t('form.fullName')}
        placeholder={t('form.fullNamePlaceholder')}
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
        label={t('form.email')}
        placeholder={t('form.emailPlaceholder')}
        variant={emailLocked ? 'flat' : 'bordered'}
        labelPlacement="outside"
        validationBehavior="aria"
        isReadOnly={emailLocked}
        description={emailLocked ? t('detail.emailLocked') : undefined}
        startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.email}
        errorMessage={fieldError(errors.email?.message)}
      />
      <Input
        {...register('phone')}
        type="tel"
        inputMode="tel"
        label={t('form.phone')}
        placeholder={t('form.phonePlaceholder')}
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<Phone aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.phone}
        errorMessage={fieldError(errors.phone?.message)}
      />
      {isCreate && (
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
                aria-describedby={errors.data_consent ? 'customer-consent-error' : undefined}
                classNames={{ label: 'text-sm text-default-600' }}
              >
                {t.rich('form.consent', {
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
                <p id="customer-consent-error" className="text-tiny text-danger">
                  {fieldError(errors.data_consent.message)}
                </p>
              )}
            </div>
          )}
        />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {props.onCancel && (
          <Button variant="light" onPress={props.onCancel}>
            {t('form.cancel')}
          </Button>
        )}
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {isCreate ? t('form.submit') : t('detail.save')}
        </Button>
      </div>
    </form>
  );
};

export default CustomerForm;
