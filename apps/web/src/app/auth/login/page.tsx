import { getTranslations } from 'next-intl/server';

import LoginForm from '@web/modules/auth/components/organisms/login-form.component';
import { sanitizeNextPath } from '@web/modules/auth/utils/access.utils';
import { mapAuthError } from '@web/modules/auth/utils/auth-errors.utils';

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const { next, error } = await searchParams;
  const t = await getTranslations('auth.login');

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">{t('title')}</h1>
      <LoginForm
        next={sanitizeNextPath(next) ?? undefined}
        initialError={error ? mapAuthError(error) : undefined}
      />
    </>
  );
};

export default LoginPage;
