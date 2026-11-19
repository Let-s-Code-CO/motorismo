'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { UserRole } from '@web/modules/auth/types/auth.types';

const LINKS = [
  { href: '/', key: 'home', adminOnly: false },
  { href: '/admin/users', key: 'users', adminOnly: true },
] as const;

/** Main menu: the current section is marked (spec 003, CA-06); admin options only for admins. */
const NavLinks = ({ role }: { role: UserRole }) => {
  const t = useTranslations('auth.header');
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1 text-sm">
      {LINKS.filter(({ adminOnly }) => !adminOnly || role === 'admin').map(({ href, key }) => {
        const isCurrent = href === '/' ? pathname === '/' : pathname?.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={isCurrent ? 'page' : undefined}
              className={`rounded-medium px-3 py-1.5 font-medium transition-colors ${
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
