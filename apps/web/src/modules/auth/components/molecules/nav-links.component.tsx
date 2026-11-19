'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Audience } from '@web/modules/auth/types/auth.types';

const LINKS: { href: string; key: string; audiences: Audience[] }[] = [
  { href: '/', key: 'home', audiences: ['admin', 'operator'] },
  { href: '/customers', key: 'customers', audiences: ['admin', 'operator'] },
  { href: '/admin/users', key: 'users', audiences: ['admin'] },
  { href: '/profile', key: 'profile', audiences: ['customer'] },
];

/**
 * Main menu: the current section is marked (spec 003, CA-06). Staff see their sections (admin
 * options only for admins, spec 002 CA-07); a customer only sees "Mi perfil" (spec 004, CA-08).
 */
const NavLinks = ({ audience }: { audience: Audience }) => {
  const t = useTranslations('auth.header');
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-0.5 text-sm sm:gap-1">
      {LINKS.filter(({ audiences }) => audiences.includes(audience)).map(({ href, key }) => {
        const isCurrent = href === '/' ? pathname === '/' : pathname?.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={isCurrent ? 'page' : undefined}
              className={`rounded-medium px-2 py-1.5 font-medium transition-colors sm:px-3 ${
                isCurrent
                  ? 'bg-default-100 text-foreground'
                  : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
              }`}
            >
              {t(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

export default NavLinks;
