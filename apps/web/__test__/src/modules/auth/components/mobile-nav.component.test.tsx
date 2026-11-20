/**
 * MobileNav — the «Menú» of a phone (spec 009, HU-01): a panel that slides in from the left with the
 * sections each role may open.
 *
 * Guards:
 * - CA-02: «Menú» opens the panel with the brand and the role's sections, each with its icon (an
 *   admin sees «Usuarios», an operator does not, a customer only «Mi perfil»); the current one is
 *   marked; choosing one closes the panel.
 * - CA-03: Escape or «Cerrar menú» close it and the focus goes back to «Menú» (touching outside is
 *   covered end to end, e2e/a11y.spec.ts).
 * - RN-01: the panel shows exactly what the role may open (the same list as the desktop menu).
 */
import type { AnchorHTMLAttributes } from 'react';

import { usePathname } from 'next/navigation';

import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import MobileNav from '@web/modules/auth/components/organisms/mobile-nav.component';
import type { Audience } from '@web/modules/auth/types/auth.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
// A plain link: jsdom has no app router to navigate with.
vi.mock('next/link', () => ({
  default: ({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
}));

const openMenu = async (audience: Audience, path = '/') => {
  vi.mocked(usePathname).mockReturnValue(path);
  renderWithProviders(<MobileNav audience={audience} />);
  // A tap focuses the button before pressing it; the panel gives the focus back there.
  const menu = screen.getByRole('button', { name: 'Menú' });
  menu.focus();
  fireEvent.click(menu);
  return screen.findByRole('dialog', { name: 'Menú principal' });
};

const sectionNames = (panel: HTMLElement) =>
  within(within(panel).getByRole('navigation'))
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('MobileNav', () => {
  it('opens a panel with the brand and every section of an admin, each with its icon (CA-02)', async () => {
    const panel = await openMenu('admin');

    expect(within(panel).getByText('Motorismo Detailing')).toBeVisible();
    expect(sectionNames(panel)).toEqual([
      'Inicio',
      'Órdenes',
      'Clientes',
      'Servicios',
      'Empleados',
      'Usuarios',
    ]);
    for (const link of within(panel).getAllByRole('link')) {
      expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('shows an operator the same sections without «Usuarios» (CA-02, RN-01)', async () => {
    const panel = await openMenu('operator');

    expect(sectionNames(panel)).toEqual([
      'Inicio',
      'Órdenes',
      'Clientes',
      'Servicios',
      'Empleados',
    ]);
  });

  it('shows a customer only «Mi perfil» (CA-02, RN-01)', async () => {
    const panel = await openMenu('customer', '/profile');

    expect(sectionNames(panel)).toEqual(['Mi perfil']);
  });

  it('marks the section the user is in, also on its sub-pages (CA-02)', async () => {
    const panel = await openMenu('operator', '/customers/abc');

    expect(within(panel).getByRole('link', { name: 'Clientes' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(panel).getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('closes once a section is chosen (CA-02)', async () => {
    const panel = await openMenu('operator');

    fireEvent.click(within(panel).getByRole('link', { name: 'Órdenes' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument()
    );
  });

  it('closes with «Cerrar menú» and gives the focus back to «Menú» (CA-03)', async () => {
    const panel = await openMenu('operator');

    fireEvent.click(within(panel).getByRole('button', { name: 'Cerrar menú' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument()
    );
    // React Aria gives the focus back once the panel has gone (next frame).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Menú' })).toHaveFocus());
  });

  it('closes with Escape (CA-03)', async () => {
    const panel = await openMenu('operator');

    fireEvent.keyDown(panel, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument()
    );
  });
});
