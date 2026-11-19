import { getTranslations } from 'next-intl/server';

import AuthHeading from '@web/modules/auth/components/atoms/auth-heading.component';
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
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />
      <LoginForm
        next={sanitizeNextPath(next) ?? undefined}
        initialError={error ? mapAuthError(error) : undefined}
      />
    </>
  );
};

export default LoginPage;
