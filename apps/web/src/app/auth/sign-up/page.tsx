import { getTranslations } from 'next-intl/server';

import AuthHeading from '@web/modules/auth/components/atoms/auth-heading.component';
import SignUpForm from '@web/modules/auth/components/organisms/sign-up-form.component';

/** Customer sign-up (spec 004, HU-01). Visitors only: the proxy sends signed-in users home. */
const SignUpPage = async () => {
  const t = await getTranslations('auth.signUp');

  return (
    <>
      <AuthHeading title={t('title')} subtitle={t('subtitle')} />
      <SignUpForm />
    </>
  );
};

export default SignUpPage;
