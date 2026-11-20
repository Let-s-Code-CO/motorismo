import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { ArrowRight, ChevronRight, Sparkles } from 'lucide-react';

import { navLinksFor } from '@web/modules/auth/constants/nav.constants';
import type { UserRole } from '@web/modules/auth/types/auth.types';
import {
  type OpenOrdersCount,
  openOrdersSummary,
} from '@web/modules/auth/utils/open-orders-summary.utils';
import BrandOrnaments from '@web/modules/core/components/brand-ornaments.component';

type StaffHomeProps = {
  name: string;
  role: UserRole;
  /** In progress and queued, for the «Órdenes» tile (spec 009, CA-07). */
  openOrders: OpenOrdersCount;
};

/** The desktop's card for every section but «Órdenes» (spec 009, CA-09: as before). */
const DESKTOP_CARD =
  'md:flex-col md:items-start md:gap-4 md:rounded-large md:border md:border-divider md:bg-content1 md:p-6 md:text-foreground md:shadow-small md:hover:border-default-300 md:hover:shadow-medium';

/**
 * The staff's home as an app menu (spec 009, HU-02).
 *
 * On a phone: «Órdenes» (what staff open all day) leads, full width, dark like the brand panel,
 * with what is in the car wash in big numbers (CA-07); the other sections follow as even tiles in
 * two columns, a black icon and the name (CA-06), and a lone last tile takes the whole row. On the
 * desktop, the cards with their description (CA-09), «Órdenes» dark with the same numbers. Only the role's
 * sections (RN-01): the same list as the menu, without «Inicio». Monochrome (RN-02). On a phone the
 * whole menu sits centred in the screen, not stuck to the top.
 */
const StaffHome = ({ name, role, openOrders }: StaffHomeProps) => {
  const t = useTranslations('auth');
  const summary = openOrdersSummary(openOrders);
  const sections = navLinksFor(role).filter(({ href }) => href !== '/');
  const others = sections.filter(({ href }) => href !== '/orders').length;

  return (
    <section className="flex flex-col gap-6 max-md:my-auto md:gap-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t('home.greeting', { name })}
        </h1>
        <p className="text-default-500">
          {t('home.role', { role: t(`roles.${role}`) })} · {t('home.subtitle')}
        </p>
      </div>

      <ul
        aria-label={t('home.sectionsLabel')}
        className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
      >
        {sections.map(({ href, key, icon: Icon }, index) => {
          const title = t(`home.${key}Title`);
          const description = (
            <span className="hidden text-sm text-default-500 md:block">{t(`home.${key}Text`)}</span>
          );

          if (key === 'orders') {
            return (
              <li key={href} className="col-span-2 flex md:col-span-1">
                {/* Dark like the brand panel, on the phone and the desktop alike; the desktop keeps
                    the card's size and its description. In the dark theme, where every card is dark,
                    it stands out by relief instead: a lighter charcoal gradient, a silver edge like
                    the logo's ring and a soft glow (spec 010, CA-06). */}
                <Link
                  href={href}
                  className="group relative flex w-full flex-col gap-5 overflow-hidden rounded-large bg-zinc-950 p-5 text-white shadow-medium transition-[box-shadow,transform] hover:shadow-large active:scale-[0.99] md:gap-4 md:p-6 dark:bg-gradient-to-br dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-950 dark:shadow-[0_0_44px_-14px_rgba(212,212,216,0.35)] dark:ring-1 dark:ring-zinc-300/35"
                >
                  <BrandOrnaments />
                  <span className="relative flex w-full items-center gap-3 md:flex-col md:items-start md:gap-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-large bg-white/10 ring-1 ring-white/20">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-lg font-semibold md:text-base">{title}</span>
                      <span className="hidden text-sm text-zinc-400 md:block">
                        {t(`home.${key}Text`)}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-5 text-zinc-400 md:hidden" />
                  </span>
                  {/* What is in the car wash (CA-07), in big numbers. */}
                  {summary.kind === 'none' ? (
                    <span className="relative text-sm text-zinc-300">{t('home.ordersNone')}</span>
                  ) : (
                    <span className="relative grid w-full grid-cols-2 gap-3">
                      {(
                        [
                          ['inProgress', summary.inProgress],
                          ['queued', summary.queued],
                        ] as const
                      ).map(([label, count]) => (
                        <span
                          key={label}
                          data-stat={label}
                          className="flex flex-col rounded-medium bg-white/[0.06] px-3 py-2 ring-1 ring-white/10"
                        >
                          <span className="text-2xl font-semibold tabular-nums">{count}</span>
                          <span className="text-xs text-zinc-400">{t(`home.${label}`)}</span>
                        </span>
                      ))}
                    </span>
                  )}
                  <ArrowRight
                    aria-hidden
                    className="relative mt-auto hidden size-4 text-zinc-400 transition-transform group-hover:translate-x-1 md:block"
                  />
                </Link>
              </li>
            );
          }

          // A lone last tile on a phone takes the whole row.
          const alone = index === sections.length - 1 && others % 2 === 1;
          return (
            <li key={href} className={`flex ${alone ? 'col-span-2 md:col-span-1' : ''}`}>
              <Link
                href={href}
                className={`group flex min-h-28 w-full flex-col justify-between gap-4 rounded-large border border-divider bg-content1 p-4 shadow-small transition-[box-shadow,border-color,transform] active:scale-[0.98] ${DESKTOP_CARD}`}
              >
                <span className="grid size-11 place-items-center rounded-medium bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] md:size-12 md:rounded-large">
                  <Icon aria-hidden className="size-5 md:size-6" />
                </span>
                <span className="flex w-full items-end justify-between gap-2 md:flex-col md:items-start md:gap-1">
                  <span className="leading-tight font-semibold">
                    {/* The menu's short name fits a tile («Usuarios»); the desktop keeps the title. */}
                    <span className="md:hidden">{t(`header.${key}`)}</span>
                    <span className="hidden md:inline">{title}</span>
                  </span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-default-400 md:hidden"
                  />
                  {description}
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-auto hidden size-4 text-default-400 transition-transform group-hover:translate-x-1 md:block"
                />
              </Link>
            </li>
          );
        })}
        {/* Information, not a section to go to: only on the desktop (CA-08). */}
        <li className="hidden md:flex">
          <div className="flex w-full flex-col gap-4 rounded-large border border-dashed border-divider p-6">
            <span className="grid size-12 place-items-center rounded-large bg-default-100 text-default-600">
              <Sparkles aria-hidden className="size-6" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t('home.soonTitle')}</span>
              <span className="text-sm text-default-500">{t('home.soonText')}</span>
            </div>
          </div>
        </li>
      </ul>
    </section>
  );
};

export default StaffHome;
