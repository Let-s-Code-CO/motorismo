'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isCurrentSection, navLinksFor } from '@web/modules/auth/constants/nav.constants';
import type { Audience } from '@web/modules/auth/types/auth.types';

/**
 * The desktop's main menu, inline in the header: the current section is marked (spec 003, CA-06)
 * and each role sees only its sections (spec 009, RN-01). On a phone the header shows «Menú»
 * instead, which opens the side panel (spec 009, CA-02).
 */
const NavLinks = ({ audience }: { audience: Audience }) => {
  const t = useTranslations('auth.header');
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1 text-sm">
      {navLinksFor(audience).map(({ href, key }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={isCurrentSection(href, pathname) ? 'page' : undefined}
            className={`rounded-medium px-3 py-1.5 font-medium transition-colors ${
              isCurrentSection(href, pathname)
                ? 'bg-default-100 text-foreground'
                : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
            }`}
          >
            {t(key)}
          </Link>
        </li>
      ))}
    </ul>
  );
};

export default NavLinks;
