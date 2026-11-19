'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Button, Input, Radio, RadioGroup } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';

import { Constants } from '@motorismo/supabase/types';

import { inviteUser } from '@web/modules/users/actions/users.actions';
import type { UsersErrorKey } from '@web/modules/users/actions/users.actions';
import {
  type InviteUserInput,
  type InviteUserValues,
  inviteUserSchema,
} from '@web/modules/users/schemas/invite-user.schema';

type InviteUserFormProps = {
  onInvited: (email: string) => void;
};

/** Name, email and role of the person to invite (CA-11, CA-12, CA-13). */
const InviteUserForm = ({ onInvited }: InviteUserFormProps) => {
  const t = useTranslations('users');
  const tRoles = useTranslations('auth.roles');
  const [serverError, setServerError] = useState<UsersErrorKey>();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<InviteUserInput, unknown, InviteUserValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { full_name: '', email: '' },
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await inviteUser(values);
    if (result.ok) {
      onInvited(values.email);
      return;
    }
    if (result.fieldErrors) {
      Object.entries(result.fieldErrors).forEach(([field, messages]) => {
        const message = messages?.[0];
        if (message) setError(field as keyof InviteUserInput, { message });
      });
      return;
    }
    setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {serverError && (
        <p role="alert" className="rounded-medium bg-danger-50 px-3 py-2 text-sm text-danger">
          {t(`errors.${serverError}`)}
        </p>
      )}
      <Input
        {...register('full_name')}
        label={t('invite.fullName')}
        autoComplete="off"
        validationBehavior="aria"
        isInvalid={!!errors.full_name}
        errorMessage={fieldError(errors.full_name?.message)}
      />
      <Input
        {...register('email')}
        type="email"
        label={t('invite.email')}
        autoComplete="off"
        validationBehavior="aria"
        isInvalid={!!errors.email}
        errorMessage={fieldError(errors.email?.message)}
      />
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <RadioGroup
            label={t('invite.role')}
            orientation="horizontal"
            value={field.value ?? ''}
            onValueChange={(value) => field.onChange(value)}
            onBlur={field.onBlur}
            validationBehavior="aria"
            isInvalid={!!errors.role}
            errorMessage={fieldError(errors.role?.message)}
          >
            {Constants.public.Enums.user_role.map((role) => (
              <Radio key={role} value={role}>
                {tRoles(role)}
              </Radio>
            ))}
          </RadioGroup>
        )}
      />
      <Button type="submit" color="primary" isLoading={isSubmitting}>
        {t('invite.submit')}
      </Button>
    </form>
  );
};

export default InviteUserForm;
