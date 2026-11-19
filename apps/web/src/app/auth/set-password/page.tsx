import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@web/modules/auth/api/auth.server';
import AuthHeading from '@web/modules/auth/components/atoms/auth-heading.component';
import SetPasswordForm from '@web/modules/auth/components/organisms/set-password-form.component';

/** Reached through an invitation or recovery link, which opened a session (see /auth/confirm). */
const SetPasswordPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const t = await getTranslations('auth.setPassword');
  const invited = user.status === 'invited';

  return (
    <>
      <AuthHeading
        title={invited ? t('titleInvited') : t('titleRecovery')}
        subtitle={invited ? t('subtitleInvited') : t('subtitleRecovery')}
      />
      <SetPasswordForm />
    </>
  );
};

export default SetPasswordPage;
