/**
 * ForgotPasswordForm (spec 002, CA-22): after sending, the user always reads the same neutral
 * message, whether or not the email is registered (RN-06).
 */
import { fireEvent, screen } from '@testing-library/react';

import { requestPasswordReset } from '@web/modules/auth/actions/auth.actions';
import ForgotPasswordForm from '@web/modules/auth/components/organisms/forgot-password-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({ requestPasswordReset: vi.fn() }));

describe('ForgotPasswordForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the neutral confirmation after sending (CA-22)', async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
    renderWithProviders(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'ana@motorismo.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(
      await screen.findByText(
        'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.'
      )
    ).toBeVisible();
    expect(requestPasswordReset).toHaveBeenCalledWith({ email: 'ana@motorismo.test' });
  });

  it('validates the email before calling the server', async () => {
    renderWithProviders(<ForgotPasswordForm />);

    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'ana' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText('Introduce un correo válido.')).toBeVisible();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});
