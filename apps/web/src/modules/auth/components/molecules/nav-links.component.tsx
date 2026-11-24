'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { ChevronDown } from 'lucide-react';

import { isCurrentSection, navLinksFor } from '@web/modules/auth/constants/nav.constants';
import type { Audience } from '@web/modules/auth/types/auth.types';

const ITEM = 'rounded-medium px-3 py-1.5 font-medium whitespace-nowrap transition-colors';
const CURRENT = 'bg-default-100 text-foreground';
const OTHER = 'text-default-500 hover:bg-default-100/60 hover:text-foreground';

/**
 * The desktop's main menu, inline in the header: the current section is marked (spec 003, CA-06)
 * and each role sees only its sections (spec 009, RN-01). The admin's own sections («Reportes»,
 * «Habeas data», «Usuarios») go together under «Administración» (spec 017): nine in a row did not
 * fit. On a phone the header shows «Menú» instead, which opens the side panel (spec 009, CA-02).
 */
const NavLinks = ({ audience }: { audience: Audience }) => {
  const t = useTranslations('auth.header');
  const pathname = usePathname();
  const router = useRouter();
  const sections = navLinksFor(audience);
  const inline = sections.filter(({ group }) => !group);
  const admin = sections.filter(({ group }) => group === 'admin');
  const inAdmin = admin.some(({ href }) => isCurrentSection(href, pathname));

  return (
    <ul className="flex items-center gap-1 text-sm">
      {inline.map(({ href, key }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={isCurrentSection(href, pathname) ? 'page' : undefined}
            className={`${ITEM} ${isCurrentSection(href, pathname) ? CURRENT : OTHER}`}
          >
            {t(key)}
          </Link>
        </li>
      ))}
      {admin.length > 0 && (
        <li>
          <Dropdown placement="bottom-end" classNames={{ trigger: 'aria-expanded:opacity-100' }}>
            <DropdownTrigger>
              <button
                type="button"
                data-current={inAdmin || undefined}
                className={`${ITEM} inline-flex items-center gap-1 ${inAdmin ? CURRENT : OTHER}`}
              >
                {t('admin')}
                <ChevronDown aria-hidden className="size-3.5" />
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={t('admin')}
              onAction={(key) => router.push(String(key))}
              selectionMode="none"
            >
              {admin.map(({ href, key, icon: Icon }) => (
                <DropdownItem
                  key={href}
                  textValue={t(key)}
                  startContent={<Icon aria-hidden className="size-4" />}
                  className={isCurrentSection(href, pathname) ? 'bg-default-100' : undefined}
                >
                  {t(key)}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </li>
      )}
    </ul>
  );
};

export default NavLinks;
