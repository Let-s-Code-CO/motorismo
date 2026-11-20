import {
  ClipboardList,
  Contact,
  HardHat,
  House,
  type LucideIcon,
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
};

/**
 * Every section of the app and who may open it: the one list behind the desktop menu, the phone's
 * panel and the staff home (spec 009, RN-01), so what each role sees can never differ between them.
 * Admin options only for admins (spec 002, CA-07); «Servicios» and «Empleados» (spec 007, CA-19);
 * «Órdenes» (spec 008); a customer only has «Mi perfil» (spec 004, CA-08).
 */
export const NAV_LINKS: NavLink[] = [
  { href: '/', key: 'home', icon: House, audiences: ['admin', 'operator'] },
  { href: '/orders', key: 'orders', icon: ClipboardList, audiences: ['admin', 'operator'] },
  { href: '/customers', key: 'customers', icon: Contact, audiences: ['admin', 'operator'] },
  { href: '/services', key: 'services', icon: Tags, audiences: ['admin', 'operator'] },
  { href: '/employees', key: 'employees', icon: HardHat, audiences: ['admin', 'operator'] },
  { href: '/admin/users', key: 'users', icon: Users, audiences: ['admin'] },
  { href: '/profile', key: 'profile', icon: UserRound, audiences: ['customer'] },
];

/** The sections this audience may open, in menu order. */
export const navLinksFor = (audience: Audience) =>
  NAV_LINKS.filter(({ audiences }) => audiences.includes(audience));

/** Whether `href` is the section of `pathname` (sub-pages belong to their section). */
export const isCurrentSection = (href: string, pathname: string | null) =>
  href === '/' ? pathname === '/' : !!pathname?.startsWith(href);
