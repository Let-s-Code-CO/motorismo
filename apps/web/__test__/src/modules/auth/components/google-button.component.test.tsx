/**
 * GoogleButton — "Continuar con Google" on the login page (spec 002, HU-06).
 *
 * Guards:
 * - The button shows Google's logo (decorative: hidden from screen readers, the text names it).
 * - It starts the Google sign-in carrying the page originally requested (CA-03).
 * - If Google is not available, the user sees an error instead of nothing happening.
 * - Spec 004, CA-20: an unknown Google account becomes a customer, so the button says that
 *   continuing authorises the processing of personal data, with a link to the policy (RN-04).
 */
import { fireEvent, screen } from '@testing-library/react';

import { signInWithGoogle } from '@web/modules/auth/actions/auth.actions';
import GoogleButton from '@web/modules/auth/components/molecules/google-button.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({ signInWithGoogle: vi.fn() }));

describe('GoogleButton', () => {
  afterEach(() => vi.clearAllMocks());

  it('says that continuing authorises the data processing, with a link to the policy (spec 004, CA-20)', () => {
    renderWithProviders(<GoogleButton />);

    expect(
      screen.getByText(/Al continuar con Google autorizas el tratamiento de tus datos personales/)
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'política de tratamiento de datos' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it("shows Google's logo inside the button, hidden from screen readers", () => {
    renderWithProviders(<GoogleButton />);

    const button = screen.getByRole('button', { name: 'Continuar con Google' });
    const logo = button.querySelector('svg[data-testid="google-logo"]');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute('aria-hidden', 'true');
  });

  it('starts the Google sign-in with the requested page (CA-03)', async () => {
    vi.mocked(signInWithGoogle).mockResolvedValue({ ok: true });
    renderWithProviders(<GoogleButton next="/admin/users" />);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

    await vi.waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith('/admin/users'));
  });

  it('shows an error when Google is not available', async () => {
    vi.mocked(signInWithGoogle).mockResolvedValue({ ok: false, error: 'generic' });
    renderWithProviders(<GoogleButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));

    expect(await screen.findByText('Algo salió mal. Inténtalo de nuevo.')).toBeVisible();
  });
});
