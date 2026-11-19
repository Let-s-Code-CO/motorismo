import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { ArrowRight, Sparkles, Users } from 'lucide-react';

import { requireUser } from '@web/modules/auth/api/auth.server';

const CARD = 'flex flex-col gap-4 rounded-large border border-divider bg-content1 p-6 shadow-small';

/** Home of the signed-in user: who they are, their role and where to go (CA-01). */
const HomePage = async () => {
  const user = await requireUser();
  const t = await getTranslations('auth');

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('home.greeting', { name: user.full_name })}
        </h1>
        <p className="text-default-500">
          {t('home.role', { role: t(`roles.${user.role}`) })} · {t('home.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {user.role === 'admin' && (
          <Link
            href="/admin/users"
            className={`${CARD} group transition-[box-shadow,border-color] hover:border-default-300 hover:shadow-medium`}
          >
            <span className="grid size-10 place-items-center rounded-medium bg-zinc-900 text-white">
              <Users aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t('home.usersTitle')}</span>
              <span className="text-sm text-default-500">{t('home.usersText')}</span>
            </div>
            <ArrowRight
              aria-hidden
              className="mt-auto size-4 text-default-400 transition-transform group-hover:translate-x-1"
            />
          </Link>
        )}
        <div className={`${CARD} border-dashed bg-transparent shadow-none`}>
          <span className="grid size-10 place-items-center rounded-medium bg-default-100 text-default-600">
            <Sparkles aria-hidden className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('home.soonTitle')}</span>
            <span className="text-sm text-default-500">{t('home.soonText')}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomePage;
