/**
 * SignUpForm — a customer creates their account (spec 004, HU-01).
 *
 * Guards:
 * - CA-01: name, email, optional phone, password and the data-processing consent, with a link to
 *   the policy.
 * - CA-06: invalid input never reaches the server; each error sits next to its field.
 * - CA-02: after signing up the person is told to confirm their email (no session yet); the same
 *   answer is given whether or not the email already existed (the server decides, CA-07).
 * - Server errors (e.g. too many attempts) are shown.
 */
import { fireEvent, screen } from '@testing-library/react';

import { signUp } from '@web/modules/auth/actions/auth.actions';
import SignUpForm from '@web/modules/auth/components/organisms/sign-up-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({
  signUp: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

const fill = (values: { name?: string; email?: string; phone?: string; password?: string }) => {
  if (values.name !== undefined)
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: values.name } });
  if (values.email !== undefined)
    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: values.email } });
  if (values.phone !== undefined)
    fireEvent.change(screen.getByLabelText(/Celular/), { target: { value: values.phone } });
  if (values.password !== undefined)
    fireEvent.change(screen.getByLabelText(/^Contraseña/), { target: { value: values.password } });
};

const consent = () => fireEvent.click(screen.getByRole('checkbox', { name: /Autorizo/ }));
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

describe('SignUpForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('asks for name, email, optional phone, password and the consent with a link to the policy (CA-01)', () => {
    renderWithProviders(<SignUpForm />);

    expect(screen.getByLabelText(/Nombre/)).toBeVisible();
    expect(screen.getByLabelText(/Correo/)).toBeVisible();
    expect(screen.getByLabelText('Celular (opcional)')).toBeVisible();
    expect(screen.getByLabelText(/^Contraseña/)).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: /Autorizo el tratamiento de mis datos/ })
    ).not.toBeChecked();
    // One link in the consent, one in the Google notice (CA-20): both lead to the policy.
    const policyLinks = screen.getAllByRole('link', { name: /política de tratamiento de datos/ });
    expect(policyLinks).toHaveLength(2);
    policyLinks.forEach((link) => expect(link).toHaveAttribute('href', '/privacy'));
  });

  it('shows each error next to its field and sends nothing (CA-06)', async () => {
    renderWithProviders(<SignUpForm />);

    fill({ name: '', email: 'camila', phone: '12345', password: '1234567' });
    submit();

    expect(await screen.findByText('Introduce tu nombre.')).toBeVisible();
    expect(screen.getByText('Introduce un correo válido.')).toBeVisible();
    expect(
      screen.getByText('Introduce un celular colombiano de 10 dígitos que empiece por 3.')
    ).toBeVisible();
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
    expect(
      screen.getByText('Debes autorizar el tratamiento de tus datos para crear la cuenta.')
    ).toBeVisible();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends the normalised data and asks the person to confirm their email (CA-02)', async () => {
    vi.mocked(signUp).mockResolvedValue({ ok: true });
    renderWithProviders(<SignUpForm />);

    fill({
      name: 'Camila Cliente',
      email: 'Camila@Correo.test',
      phone: '300 123 4567',
      password: '12345678',
    });
    consent();
    submit();

    expect(
      await screen.findByText('Te enviamos un correo para confirmar tu cuenta.')
    ).toBeVisible();
    expect(screen.getByText(/camila@correo\.test/)).toBeVisible();
    expect(signUp).toHaveBeenCalledWith({
      full_name: 'Camila Cliente',
      email: 'camila@correo.test',
      phone: '3001234567',
      password: '12345678',
      data_consent: true,
    });
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).not.toBeInTheDocument();
  });

  it('shows a server error and keeps the form', async () => {
    vi.mocked(signUp).mockResolvedValue({ ok: false, error: 'rateLimited' });
    renderWithProviders(<SignUpForm />);

    fill({ name: 'Camila', email: 'camila@correo.test', password: '12345678' });
    consent();
    submit();

    expect(
      await screen.findByText('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeVisible();
  });
});
