import {
  CalendarClock,
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
  { href: '/services', key: 'services', icon: Tags, audiences: ['admin', 'operator'] },
  { href: '/employees', key: 'employees', icon: HardHat, audiences: ['admin', 'operator'] },
  // Spec 015: the reports, with the business's figures: admin only.
  { href: '/reports', key: 'reports', icon: FileSpreadsheet, audiences: ['admin'] },
  // Spec 017: the requests of the data subject, admin only.
  { href: '/admin/data-requests', key: 'dataRequests', icon: ShieldCheck, audiences: ['admin'] },
  { href: '/admin/users', key: 'users', icon: Users, audiences: ['admin'] },
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

/** Whether `href` is the section of `pathname` (sub-pages belong to their section). */
export const isCurrentSection = (href: string, pathname: string | null) =>
  HOMES.includes(href) ? pathname === href : !!pathname?.startsWith(href);
