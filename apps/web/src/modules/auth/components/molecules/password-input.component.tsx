'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Input, type InputProps } from '@heroui/react';
import { Eye, EyeOff, Lock } from 'lucide-react';

/** Password field with show / hide (spec 003, CA-05). Accepts every HeroUI Input prop. */
const PasswordInput = (props: Omit<InputProps, 'type'>) => {
  const t = useTranslations('auth.password');
  const [visible, setVisible] = useState(false);

  return (
    <Input
      variant="bordered"
      labelPlacement="outside"
      validationBehavior="aria"
      startContent={<Lock aria-hidden className="size-4 shrink-0 text-default-400" />}
      endContent={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t('hide') : t('show')}
          className="rounded-small text-default-400 outline-none transition-colors hover:text-default-600 focus-visible:ring-2 focus-visible:ring-focus"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-4" />
          ) : (
            <Eye aria-hidden className="size-4" />
          )}
        </button>
      }
      {...props}
      type={visible ? 'text' : 'password'}
    />
  );
};

export default PasswordInput;
