import {
  CalendarClock,
  CarFront,
  ClipboardList,
  Contact,
  FileSpreadsheet,
  HardHat,
  History,
  House,
  type LucideIcon,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
} from 'lucide-react';

import type { Audience } from '@web/modules/auth/types/auth.types';

export type NavLink = {
  href: string;
  /** Text key under `auth.header`, and under `auth.home` (`…Title`, `…Text`) for the home tiles. */
  key: string;
  icon: LucideIcon;
  audiences: Audience[];
  /**
   * For an admin, these go together in the desktop menu, under «Administración» (specs 017 and
   * 018): the sections they configure, which change little. Whoever has no «Administración» (the
   * operator) sees them in the bar. The phone's panel and the home list them all.
   */
  group?: 'admin';
};

/**
 * Every section of the app and who may open it: the one list behind the desktop menu, the phone's
 * panel and the staff home (spec 009, RN-01), so what each role sees can never differ between them.
 * Admin options only for admins (spec 002, CA-07); «Servicios» and «Empleados» (spec 007, CA-19);
 * «Órdenes» (spec 008); «Agenda» (spec 012); «Reportes», admin only (spec 015); a customer has their «Inicio», «Mis reservas»,
 * «Historial» and «Mi perfil» (spec 004, CA-08; spec 014).
 */
export const NAV_LINKS: NavLink[] = [
  { href: '/', key: 'home', icon: House, audiences: ['admin', 'operator'] },
  { href: '/orders', key: 'orders', icon: ClipboardList, audiences: ['admin', 'operator'] },
  { href: '/agenda', key: 'agenda', icon: CalendarClock, audiences: ['admin', 'operator'] },
  { href: '/customers', key: 'customers', icon: Contact, audiences: ['admin', 'operator'] },
  {
    href: '/services',
    key: 'services',
    icon: Tags,
    audiences: ['admin', 'operator'],
    group: 'admin',
  },
  {
    href: '/employees',
    key: 'employees',
    icon: HardHat,
    audiences: ['admin', 'operator'],
    group: 'admin',
  },
  // Spec 015: the reports, with the business's figures: admin only.
  { href: '/reports', key: 'reports', icon: FileSpreadsheet, audiences: ['admin'], group: 'admin' },
  // Spec 017: the requests of the data subject, admin only.
  {
    href: '/admin/data-requests',
    key: 'dataRequests',
    icon: ShieldCheck,
    audiences: ['admin'],
    group: 'admin',
  },
  // Spec 018: the vehicle brands and lines catalog, admin only.
  {
    href: '/admin/vehicle-catalog',
    key: 'vehicleCatalog',
    icon: CarFront,
    audiences: ['admin'],
    group: 'admin',
  },
  { href: '/admin/users', key: 'users', icon: Users, audiences: ['admin'], group: 'admin' },
  // Spec 014: the customer's own area.
  { href: '/my', key: 'myHome', icon: House, audiences: ['customer'] },
  { href: '/my/reservations', key: 'myReservations', icon: CalendarClock, audiences: ['customer'] },
  { href: '/my/history', key: 'myHistory', icon: History, audiences: ['customer'] },
  { href: '/profile', key: 'profile', icon: UserRound, audiences: ['customer'] },
];

/** The homes: only their own page, never their sub-pages' sections (`/my/history` is not «Inicio»). */
const HOMES = ['/', '/my'];

/** The sections this audience may open, in menu order. */
export const navLinksFor = (audience: Audience) =>
  NAV_LINKS.filter(({ audiences }) => audiences.includes(audience));

/** An entry of the desktop bar: a section, or the menu of a group of sections. */
export type NavEntry =
  { kind: 'link'; link: NavLink } | { kind: 'group'; group: 'admin'; links: NavLink[] };

/**
 * The entries of the desktop bar for this audience, in menu order (spec 018, CA-21): the sections of
 * a group go together, as one entry where the first of them is, but only for an admin (whoever has
 * «Administración»); anyone else sees them in line.
 */
export const navEntriesFor = (audience: Audience): NavEntry[] => {
  const entries: NavEntry[] = [];
  for (const link of navLinksFor(audience)) {
    const group = audience === 'admin' ? link.group : undefined;
    const existing = entries.find((entry) => entry.kind === 'group' && entry.group === group);
    if (!group) entries.push({ kind: 'link', link });
    else if (existing?.kind === 'group') existing.links.push(link);
    else entries.push({ kind: 'group', group, links: [link] });
  }
  return entries;
};

/** Whether `href` is the section of `pathname` (sub-pages belong to their section). */
export const isCurrentSection = (href: string, pathname: string | null) =>
  HOMES.includes(href) ? pathname === href : !!pathname?.startsWith(href);
