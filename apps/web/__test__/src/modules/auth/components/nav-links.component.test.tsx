/**
 * NavLinks — main menu (spec 003, CA-06; spec 002, CA-07).
 *
 * Guards: the section the user is in is marked as current (aria-current="page"), and the admin-only
 * option is not rendered for operators.
 */
import { usePathname } from 'next/navigation';

import { screen } from '@testing-library/react';

import NavLinks from '@web/modules/auth/components/molecules/nav-links.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

describe('NavLinks', () => {
  it('marks the current section (CA-06)', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/users');
    renderWithProviders(<NavLinks role="admin" />);

    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('marks Inicio on the home page and hides Usuarios from operators', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks role="operator" />);

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });
});
