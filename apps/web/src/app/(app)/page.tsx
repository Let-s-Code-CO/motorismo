import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArrowRight, Contact, HardHat, type LucideIcon, Sparkles, Tags, Users } from 'lucide-react';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';

const CARD = 'flex flex-col gap-4 rounded-large border border-divider bg-content1 p-6 shadow-small';

const LINK_CARD = `${CARD} group transition-[box-shadow,border-color] hover:border-default-300 hover:shadow-medium`;

/** Where staff can go from home; «Usuarios» only for an admin (spec 002, CA-07; spec 007, CA-19). */
const SECTIONS: { href: string; key: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { href: '/customers', key: 'customers', icon: Contact },
  { href: '/services', key: 'services', icon: Tags },
  { href: '/employees', key: 'employees', icon: HardHat },
  { href: '/admin/users', key: 'users', icon: Users, adminOnly: true },
];

/** Home of the staff: who they are, their role and where to go (CA-01). Customers have "Mi perfil". */
const HomePage = async () => {
  const user = await getStaffForPage();
  // The proxy already sends customers to their profile (spec 004, CA-12); this is the second check.
  if (!user) redirect('/profile');
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
        {SECTIONS.filter(({ adminOnly }) => !adminOnly || user.role === 'admin').map(
          ({ href, key, icon: Icon }) => (
            <Link key={href} href={href} className={LINK_CARD}>
              <span className="grid size-10 place-items-center rounded-medium bg-zinc-900 text-white">
                <Icon aria-hidden className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{t(`home.${key}Title`)}</span>
                <span className="text-sm text-default-500">{t(`home.${key}Text`)}</span>
              </div>
              <ArrowRight
                aria-hidden
                className="mt-auto size-4 text-default-400 transition-transform group-hover:translate-x-1"
              />
            </Link>
          )
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
