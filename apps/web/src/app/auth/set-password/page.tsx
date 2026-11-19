import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@web/modules/auth/api/auth.server';
import SetPasswordForm from '@web/modules/auth/components/organisms/set-password-form.component';

/** Reached through an invitation or recovery link, which opened a session (see /auth/confirm). */
const SetPasswordPage = async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const t = await getTranslations('auth.setPassword');

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">
        {user.status === 'invited' ? t('titleInvited') : t('titleRecovery')}
      </h1>
      <SetPasswordForm />
    </>
  );
};

export default SetPasswordPage;
