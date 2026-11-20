/**
 * AccountMenu — the avatar of a phone's header (spec 009, HU-01): the account lives in its menu, so
 * the header keeps only «Menú», the logo and the avatar.
 *
 * Guards:
 * - CA-04 / RF-02: the avatar («Tu cuenta») opens a menu with the person's name and role (or
 *   «Cliente»), «Instalar app» only where the app can be installed (spec 006, CA-12 to CA-14:
 *   the browser's own install, or the steps on an iPhone or iPad) and «Cerrar sesión».
 * - The avatar button's name contains what it shows (WCAG 2.5.3): «CD, tu cuenta» with the
 *   initials, «Tu cuenta» with a photo.
 * - «Cerrar sesión» goes through callAction, like every Server Action call (spec 006, CA-10).
 * - Spec 010, CA-09: «Tema» with Claro, Oscuro and Sistema, each with its icon; the current one is
 *   marked (a check, and «elegido» for screen readers); choosing one changes the theme at once.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { signOut } from '@web/modules/auth/actions/auth.actions';
import AccountMenu from '@web/modules/auth/components/molecules/account-menu.component';
import type { Audience } from '@web/modules/auth/types/auth.types';
import useInstallPrompt from '@web/modules/pwa/hooks/install-prompt.hook';
import { promptInstall } from '@web/modules/pwa/utils/install-prompt.lib';
import { ThemeProvider } from '@web/modules/theme/providers/theme.provider';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({ signOut: vi.fn(async () => {}) }));
vi.mock('@web/modules/pwa/hooks/install-prompt.hook', () => ({ default: vi.fn(() => null) }));
vi.mock('@web/modules/pwa/utils/install-prompt.lib', () => ({ promptInstall: vi.fn() }));

const openAccount = async ({
  name = 'Carlos Díaz',
  audience = 'admin' as Audience,
}: { name?: string; audience?: Audience } = {}) => {
  renderWithProviders(
    <ThemeProvider initialChoice="system">
      <AccountMenu name={name} avatarUrl={null} audience={audience} />
    </ThemeProvider>
  );
  fireEvent.click(screen.getByRole('button', { name: /tu cuenta$/ }));
  return screen.findByRole('menu');
};

describe('AccountMenu', () => {
  beforeEach(() =>
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  );
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('names the avatar with the initials it shows, or «Tu cuenta» with a photo (CA-04; WCAG 2.5.3)', () => {
    const { unmount } = renderWithProviders(
      <AccountMenu name="Carlos Díaz" avatarUrl={null} audience="admin" />
    );
    expect(screen.getByRole('button', { name: 'CD, tu cuenta' })).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <AccountMenu name="Carlos Díaz" avatarUrl="https://example.test/photo.jpg" audience="admin" />
    );
    expect(screen.getByRole('button', { name: 'Tu cuenta' })).toBeInTheDocument();
  });

  it('heads the menu with who is signed in and their role, as text, not an option (CA-04)', async () => {
    const menu = await openAccount();

    // Present in the open menu (its opening animation keeps jsdom from calling it visible).
    expect(screen.getByText('Carlos Díaz')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    // Who is signed in is not an option (axe: an option's name must contain all it shows).
    expect(within(menu).queryByRole('menuitem', { name: /Carlos Díaz/ })).not.toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('says «Cliente» for a customer (CA-04)', async () => {
    await openAccount({ name: 'Camila Cliente', audience: 'customer' });

    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('offers no «Instalar app» where the app cannot be installed (CA-04; spec 006, CA-14)', async () => {
    await openAccount();

    expect(screen.queryByRole('menuitem', { name: 'Instalar app' })).not.toBeInTheDocument();
  });

  it('asks the browser to install the app where it can (CA-04; spec 006, CA-12)', async () => {
    vi.mocked(useInstallPrompt).mockReturnValue('prompt');
    await openAccount();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Instalar app' }));

    await waitFor(() => expect(promptInstall).toHaveBeenCalledOnce());
  });

  it('shows the steps on an iPhone or iPad (CA-04; spec 006, CA-13)', async () => {
    vi.mocked(useInstallPrompt).mockReturnValue('ios');
    await openAccount();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Instalar app' }));

    expect(
      await screen.findByRole('dialog', { name: 'Instalar Motorismo en tu iPhone o iPad' })
    ).toBeInTheDocument();
    expect(promptInstall).not.toHaveBeenCalled();
  });

  it('signs out from «Cerrar sesión» (CA-04)', async () => {
    await openAccount();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  });

  it('offers «Tema» with its three choices, the current one marked (spec 010, CA-09)', async () => {
    const menu = await openAccount();

    const choices = within(menu).getAllByRole('menuitem', { name: /^(Claro|Oscuro|Sistema)/ });
    expect(
      choices.map((choice) =>
        [...(choice.querySelector('svg')?.classList ?? [])].find((name) =>
          /^lucide-(sun|moon|monitor)$/.test(name)
        )
      )
    ).toEqual(['lucide-sun', 'lucide-moon', 'lucide-monitor']);
    // Nothing chosen yet on this device: «Sistema».
    expect(
      within(menu).getByRole('menuitem', { name: /^Sistema\s*,\s*elegido$/ })
    ).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Oscuro' })).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem', { name: /elegido/ })).toHaveLength(1);
  });

  it('changes the theme at once when one is chosen (spec 010, CA-09)', async () => {
    document.documentElement.classList.remove('dark');
    const menu = await openAccount();

    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Oscuro' }));

    expect(document.documentElement).toHaveClass('dark');
    document.documentElement.classList.remove('dark');
  });
});
