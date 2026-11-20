'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button, Drawer, DrawerBody, DrawerContent } from '@heroui/react';
import { Menu, X } from 'lucide-react';

import { isCurrentSection, navLinksFor } from '@web/modules/auth/constants/nav.constants';
import type { Audience } from '@web/modules/auth/types/auth.types';
import BrandBadge from '@web/modules/core/components/brand-badge.component';

/**
 * The «Menú» of a phone (spec 009, HU-01): a panel that slides in from the left with the brand and
 * the sections the role may open (RN-01), each with its icon and the current one marked (CA-02).
 * Choosing a section closes it; so do Escape, a touch outside and «Cerrar menú», and the focus goes
 * back to «Menú» (CA-03). Modal: screen readers do not read what is behind it.
 */
const MobileNav = ({ audience }: { audience: Audience }) => {
  const t = useTranslations();
  const pathname = usePathname();
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="light"
        className="h-11 min-w-11 px-2 font-medium"
        startContent={<Menu aria-hidden className="size-5" />}
        onPress={() => setOpen(true)}
      >
        {t('auth.header.menu')}
      </Button>
      <Drawer
        isOpen={isOpen}
        onOpenChange={setOpen}
        placement="left"
        size="xs"
        hideCloseButton
        classNames={{ base: 'rounded-none sm:rounded-r-large' }}
      >
        <DrawerContent aria-label={t('auth.header.mainMenu')}>
          {(close) => (
            <DrawerBody className="gap-6 px-4 py-5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <BrandBadge size={40} alt="" />
                  <span className="font-semibold tracking-tight">{t('core.brand.name')}</span>
                </span>
                <Button
                  isIconOnly
                  variant="light"
                  className="size-11"
                  aria-label={t('auth.header.closeMenu')}
                  onPress={close}
                >
                  <X aria-hidden className="size-5" />
                </Button>
              </div>
              <nav aria-label={t('auth.header.navLabel')}>
                <ul className="flex flex-col gap-1">
                  {navLinksFor(audience).map(({ href, key, icon: Icon }) => {
                    const current = isCurrentSection(href, pathname);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          aria-current={current ? 'page' : undefined}
                          onClick={close}
                          className={`flex min-h-12 items-center gap-3 rounded-large px-3 font-medium transition-colors ${
                            current
                              ? 'bg-primary text-primary-foreground'
                              : 'text-foreground hover:bg-default-100'
                          }`}
                        >
                          <Icon aria-hidden className="size-5 shrink-0" />
                          {t(`auth.header.${key}`)}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </DrawerBody>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default MobileNav;
