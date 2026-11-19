import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import AuthHeading from '@web/modules/auth/components/atoms/auth-heading.component';
import ForgotPasswordForm from '@web/modules/auth/components/organisms/forgot-password-form.component';

const ForgotPasswordPage = async () => {
  const t = await getTranslations('auth.forgotPassword');

  return (
    <>
      <AuthHeading title={t('title')} subtitle={t('description')} />
      <div className="flex flex-col gap-6">
        <ForgotPasswordForm />
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-default-600 hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('backToLogin')}
        </Link>
      </div>
    </>
  );
};

export default ForgotPasswordPage;
