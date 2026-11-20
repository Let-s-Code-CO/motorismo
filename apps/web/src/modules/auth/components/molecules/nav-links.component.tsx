'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { Menu } from 'lucide-react';

import type { Audience } from '@web/modules/auth/types/auth.types';

const LINKS: { href: string; key: string; audiences: Audience[] }[] = [
  { href: '/', key: 'home', audiences: ['admin', 'operator'] },
  { href: '/orders', key: 'orders', audiences: ['admin', 'operator'] },
  { href: '/customers', key: 'customers', audiences: ['admin', 'operator'] },
  { href: '/services', key: 'services', audiences: ['admin', 'operator'] },
  { href: '/employees', key: 'employees', audiences: ['admin', 'operator'] },
  { href: '/admin/users', key: 'users', audiences: ['admin'] },
  { href: '/profile', key: 'profile', audiences: ['customer'] },
];

/** Up to this many options fit inline on a phone (a customer's «Mi perfil»). */
const INLINE_ON_PHONES = 2;

/**
 * Main menu: the current section is marked (spec 003, CA-06). Staff see their sections (admin
 * options only for admins, spec 002 CA-07; «Servicios» and «Empleados», spec 007 CA-19); a customer
 * only sees "Mi perfil" (spec 004, CA-08). With more options than fit a phone, below the desktop
 * width they move into a «Menú» button, so the header never scrolls sideways (spec 003, CA-02).
 */
const NavLinks = ({ audience }: { audience: Audience }) => {
  const t = useTranslations('auth.header');
  const pathname = usePathname();
  const links = LINKS.filter(({ audiences }) => audiences.includes(audience));
  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : !!pathname?.startsWith(href);
  const collapses = links.length > INLINE_ON_PHONES;

  return (
    <>
      <ul
        className={`items-center gap-0.5 text-sm sm:gap-1 ${collapses ? 'hidden md:flex' : 'flex'}`}
      >
        {links.map(({ href, key }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isCurrent(href) ? 'page' : undefined}
              className={`rounded-medium px-2 py-1.5 font-medium transition-colors sm:px-3 ${
                isCurrent(href)
                  ? 'bg-default-100 text-foreground'
                  : 'text-default-500 hover:bg-default-100/60 hover:text-foreground'
              }`}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
      {collapses && (
        <div className="md:hidden">
          <Dropdown placement="bottom-start">
            <DropdownTrigger>
              <Button
                size="sm"
                variant="light"
                className="font-medium"
                startContent={<Menu aria-hidden className="size-4" />}
              >
                {t('menu')}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label={t('navLabel')}
              selectionMode="single"
              selectedKeys={links.filter(({ href }) => isCurrent(href)).map(({ href }) => href)}
            >
              {links.map(({ href, key }) => (
                <DropdownItem key={href} href={href}>
                  {t(key)}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
      )}
    </>
  );
};

export default NavLinks;
