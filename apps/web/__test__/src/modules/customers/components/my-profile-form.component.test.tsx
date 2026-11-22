/**
 * MyProfileForm — "Mi perfil": a customer keeps their data up to date (spec 004, HU-03).
 *
 * Guards:
 * - CA-12: shows name, email, phone and the sign-up date.
 * - CA-13: valid changes are sent and confirmed with «Tus datos se guardaron.», as a floating
 *   notice (spec 013, CA-01); a refusal stays inside the form (spec 013, CA-08).
 * - CA-14: an empty name or an invalid phone is reported next to the field and nothing is sent;
 *   the email is shown but cannot be changed.
 */
import { fireEvent, screen } from '@testing-library/react';

import { updateMyProfile } from '@web/modules/customers/actions/customers.actions';
import MyProfileForm from '@web/modules/customers/components/organisms/my-profile-form.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/customers/actions/customers.actions', () => ({ updateMyProfile: vi.fn() }));

const customer = {
  full_name: 'Camila Cliente',
  email: 'cliente@motorismo.test',
  phone: '3001234567',
  created_at: '2026-11-01T15:00:00.000Z',
};

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

describe('MyProfileForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the name, email, phone and sign-up date (CA-12)', () => {
    renderWithProviders(<MyProfileForm customer={customer} />);

    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Camila Cliente');
    expect(screen.getByLabelText(/Celular/)).toHaveValue('300 123 4567');
    expect(screen.getByText('Cliente desde el 1 de noviembre de 2026')).toBeVisible();
  });

  it('shows the email but does not let the customer change it (CA-14, RN-10)', () => {
    renderWithProviders(<MyProfileForm customer={customer} />);

    const email = screen.getByLabelText(/Correo/);
    expect(email).toHaveValue('cliente@motorismo.test');
    expect(email).toHaveAttribute('readonly');
  });

  it('sends the new name and phone and confirms it (CA-13)', async () => {
    vi.mocked(updateMyProfile).mockResolvedValue({ ok: true });
    renderWithProviders(<MyProfileForm customer={customer} />);

    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Camila Rojas' } });
    fireEvent.change(screen.getByLabelText(/Celular/), { target: { value: '311 222 3344' } });
    save();

    expect(await inToasts().findByText('Tus datos se guardaron.')).toBeVisible();
    expect(updateMyProfile).toHaveBeenCalledWith({
      full_name: 'Camila Rojas',
      phone: '3112223344',
    });
  });

  it('reports an empty name and an invalid phone and sends nothing (CA-14)', async () => {
    renderWithProviders(<MyProfileForm customer={customer} />);

    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Celular/), { target: { value: '12345' } });
    save();

    expect(await screen.findByText('Introduce el nombre.')).toBeVisible();
    expect(
      screen.getByText('Introduce un celular colombiano de 10 dígitos que empiece por 3.')
    ).toBeVisible();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('shows the error returned by the server inside the form, not as a floating notice (spec 013, CA-08)', async () => {
    vi.mocked(updateMyProfile).mockResolvedValue({ ok: false, error: 'generic' });
    renderWithProviders(<MyProfileForm customer={customer} />);

    save();

    expect(await screen.findByText('Algo salió mal. Inténtalo de nuevo.')).toBeVisible();
    expect(inToasts().queryByText('Algo salió mal. Inténtalo de nuevo.')).not.toBeInTheDocument();
  });
});
