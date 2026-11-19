import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import ForgotPasswordForm from '@web/modules/auth/components/organisms/forgot-password-form.component';

const ForgotPasswordPage = async () => {
  const t = await getTranslations('auth.forgotPassword');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-default-500">{t('description')}</p>
      </div>
      <ForgotPasswordForm />
      <Link href="/auth/login" className="text-sm text-primary underline">
        {t('backToLogin')}
      </Link>
    </div>
  );
};

export default ForgotPasswordPage;
