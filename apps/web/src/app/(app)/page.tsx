import { getTranslations } from 'next-intl/server';

import { requireUser } from '@web/modules/auth/api/auth.server';

/** Home of the signed-in user: who they are and with which role (CA-01). */
const HomePage = async () => {
  const user = await requireUser();
  const t = await getTranslations('auth');

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('home.greeting', { name: user.full_name })}</h1>
      <p className="text-default-500">{t('home.role', { role: t(`roles.${user.role}`) })}</p>
    </section>
  );
};

export default HomePage;
