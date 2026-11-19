'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Input } from '@heroui/react';
import { Mail } from 'lucide-react';

import ResendConfirmation from '@web/modules/auth/components/molecules/resend-confirmation.component';

/** On the invalid-link page of a sign-up confirmation: ask for a new email (spec 004, CA-05). */
const ResendConfirmationForm = () => {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="email"
        value={email}
        onValueChange={setEmail}
        label={t('signUp.email')}
        placeholder={t('signUp.emailPlaceholder')}
        autoComplete="email"
        variant="bordered"
        labelPlacement="outside"
        startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
      />
      <ResendConfirmation getEmail={() => email} />
    </div>
  );
};

export default ResendConfirmationForm;
