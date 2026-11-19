/**
 * LoginForm — email + password sign-in (spec 002, HU-01).
 *
 * Guards:
 * - CA-02: a failed sign-in shows "Correo o contraseña incorrectos." whatever the cause.
 * - CA-06: a message passed by the proxy (e.g. account disabled) is shown on arrival.
 * - Invalid input never reaches the server; each error sits next to its field (accessibility).
 * - The page the user originally asked for (CA-03) travels with the sign-in.
 * - Spec 004: a link to "Crear cuenta" (CA-01); an unconfirmed account is told to confirm its
 *   email and can have the confirmation re-sent to the typed email (CA-04).
 */
import { fireEvent, screen } from '@testing-library/react';

import { resendConfirmation, signIn } from '@web/modules/auth/actions/auth.actions';
import LoginForm from '@web/modules/auth/components/organisms/login-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  resendConfirmation: vi.fn(),
}));

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/Contraseña/), { target: { value: password } });
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

describe('LoginForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the message received from the proxy, e.g. a disabled account (CA-06)', () => {
    renderWithProviders(<LoginForm initialError="accountDisabled" />);

    expect(
      screen.getByText('Tu cuenta está desactivada. Contacta al administrador.')
    ).toBeVisible();
  });

  it('validates before calling the server and shows each error next to its field', async () => {
    renderWithProviders(<LoginForm />);

    fill('ana', '');
    submit();

    expect(await screen.findByText('Introduce un correo válido.')).toBeVisible();
    expect(screen.getByText('Introduce tu contraseña.')).toBeVisible();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('sends the credentials and the requested page, and shows the generic failure (CA-02, CA-03)', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, error: 'invalidCredentials' });
    renderWithProviders(<LoginForm next="/admin/users" />);

    fill('ana@motorismo.test', 'wrong-password');
    submit();

    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeVisible();
    expect(signIn).toHaveBeenCalledWith(
      { email: 'ana@motorismo.test', password: 'wrong-password' },
      '/admin/users'
    );
  });

  it('links to the sign-up page (spec 004, CA-01)', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/auth/sign-up'
    );
  });

  it('asks an unconfirmed account to confirm and re-sends the email to the typed address (spec 004, CA-04)', async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, error: 'emailNotConfirmed' });
    vi.mocked(resendConfirmation).mockResolvedValue({ ok: true });
    renderWithProviders(<LoginForm />);

    fill('camila@correo.test', 'cliente-nuevo-1');
    submit();

    expect(await screen.findByText('Confirma tu correo para entrar.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar correo de confirmación' }));

    expect(
      await screen.findByText(
        'Si tu cuenta está pendiente de confirmar, te enviamos un nuevo correo.'
      )
    ).toBeVisible();
    expect(resendConfirmation).toHaveBeenCalledWith('camila@correo.test');
  });
});
