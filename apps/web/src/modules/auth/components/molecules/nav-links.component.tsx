'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from '@heroui/react';
import { ChevronDown } from 'lucide-react';

import {
  type NavEntry,
  type NavLink,
  isCurrentSection,
  navEntriesFor,
} from '@web/modules/auth/constants/nav.constants';
import type { Audience } from '@web/modules/auth/types/auth.types';
import { visibleCount } from '@web/modules/auth/utils/nav-overflow.utils';

const ITEM = 'rounded-medium px-3 py-1.5 font-medium whitespace-nowrap transition-colors';
const CURRENT = 'bg-default-100 text-foreground';
const OTHER = 'text-default-500 hover:bg-default-100/60 hover:text-foreground';
const MENU_TRIGGER = `${ITEM} inline-flex items-center gap-1`;

const isCurrentEntry = (entry: NavEntry, pathname: string | null) =>
  entry.kind === 'link'
    ? isCurrentSection(entry.link.href, pathname)
    : entry.links.some(({ href }) => isCurrentSection(href, pathname));

/**
 * The desktop's main menu, inline in the header: the current section is marked (spec 003, CA-06)
 * and each role sees only its sections (spec 009, RN-01).
 * - An admin's sections to configure go together under «Administración» (specs 017 and 018,
 *   CA-21); the operator sees Servicios and Empleados in line.
 * - What does not fit in the bar goes, from the end, to «Más ▾» (spec 018, CA-25), «Administración»
 *   as a section inside it. A hidden copy of the bar measures each entry; the bar's room is watched,
 *   so entries move in and out as the window changes (CA-24). Before measuring, everything is in
 *   line: today it all fits from the desktop width (1024 px) up.
 * On a phone the header shows «Menú» instead, which opens the side panel (spec 009, CA-02).
 */
const NavLinks = ({ audience }: { audience: Audience }) => {
  const t = useTranslations('auth.header');
  const pathname = usePathname();
  const router = useRouter();
  const entries = navEntriesFor(audience);
  const [shown, setShown] = useState(entries.length);
  const room = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    const box = room.current;
    const copy = ruler.current;
    if (!box || !copy) return;
    const measure = () => {
      const items = Array.from(copy.children) as HTMLElement[];
      const widths = items
        .slice(0, entries.length)
        .map((item) => item.getBoundingClientRect().width);
      const more = items[entries.length]?.getBoundingClientRect().width ?? 0;
      const gap = Number.parseFloat(getComputedStyle(copy).columnGap) || 0;
      setShown(visibleCount(widths, box.clientWidth, more, gap));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [entries.length]);

  const inline = entries.slice(0, shown);
  const overflow = entries.slice(shown);
  const inMore = overflow.some((entry) => isCurrentEntry(entry, pathname));

  const menuItem = ({ href, key, icon: Icon }: NavLink) => (
    <DropdownItem
      key={href}
      textValue={t(key)}
      startContent={<Icon aria-hidden className="size-4" />}
      className={isCurrentSection(href, pathname) ? 'bg-default-100' : undefined}
    >
      {t(key)}
    </DropdownItem>
  );

  const menu = (label: string, isCurrent: boolean, children: React.ReactNode) => (
    <Dropdown placement="bottom-end" classNames={{ trigger: 'aria-expanded:opacity-100' }}>
      <DropdownTrigger>
        <button
          type="button"
          data-current={isCurrent || undefined}
          className={`${MENU_TRIGGER} ${isCurrent ? CURRENT : OTHER}`}
        >
          {label}
          <ChevronDown aria-hidden className="size-3.5" />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={label}
        onAction={(key) => router.push(String(key))}
        selectionMode="none"
      >
        {children as never}
      </DropdownMenu>
    </Dropdown>
  );

  return (
    <div ref={room} className="relative w-full min-w-0">
      <ul className="flex items-center gap-1 text-sm">
        {inline.map((entry) =>
          entry.kind === 'link' ? (
            <li key={entry.link.href}>
              <Link
                href={entry.link.href}
                aria-current={isCurrentSection(entry.link.href, pathname) ? 'page' : undefined}
                className={`${ITEM} ${isCurrentSection(entry.link.href, pathname) ? CURRENT : OTHER}`}
              >
                {t(entry.link.key)}
              </Link>
            </li>
          ) : (
            <li key={entry.group}>
              {menu(t(entry.group), isCurrentEntry(entry, pathname), entry.links.map(menuItem))}
            </li>
          )
        )}
        {overflow.length > 0 && (
          <li>
            {menu(
              t('more'),
              inMore,
              overflow.map((entry) =>
                entry.kind === 'link' ? (
                  menuItem(entry.link)
                ) : (
                  <DropdownSection key={entry.group} title={t(entry.group)}>
                    {entry.links.map(menuItem)}
                  </DropdownSection>
                )
              )
            )}
          </li>
        )}
      </ul>

      {/* The measure: every entry and «Más», as wide as in the bar; out of sight, out of reach. */}
      <ul
        ref={ruler}
        aria-hidden
        inert
        className="pointer-events-none invisible absolute top-0 left-0 flex items-center gap-1 text-sm"
      >
        {entries.map((entry) => (
          <li key={entry.kind === 'link' ? entry.link.href : entry.group}>
            <span className={entry.kind === 'link' ? ITEM : MENU_TRIGGER}>
              {entry.kind === 'link' ? t(entry.link.key) : t(entry.group)}
              {entry.kind === 'group' && <ChevronDown aria-hidden className="size-3.5" />}
            </span>
          </li>
        ))}
        <li>
          <span className={MENU_TRIGGER}>
            {t('more')}
            <ChevronDown aria-hidden className="size-3.5" />
          </span>
        </li>
      </ul>
    </div>
  );
};

export default NavLinks;
