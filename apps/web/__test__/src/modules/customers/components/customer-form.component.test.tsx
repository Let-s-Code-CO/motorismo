/**
 * CustomerForm — staff register and edit customers at the counter (spec 004, HU-06).
 *
 * Guards:
 * - CA-24: a customer is registered with a name and at least an email or a phone, once staff
 *   confirm the customer's consent; the screen is notified.
 * - CA-25: invalid input, missing contact or missing consent are reported next to each field and
 *   nothing is sent.
 * - CA-26: the "email already in use" refusal from the database is shown.
 * - CA-27: editing changes name, phone and — only without account — email; the email of a customer
 *   with an account is read-only and explains why.
 */
import { fireEvent, screen } from '@testing-library/react';

import { createCustomer, updateCustomer } from '@web/modules/customers/actions/customers.actions';
import CustomerForm from '@web/modules/customers/components/organisms/customer-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/customers/actions/customers.actions', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('CustomerForm (new customer)', () => {
  afterEach(() => vi.clearAllMocks());

  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));

  it('reports a missing name, missing contact and missing consent, and sends nothing (CA-25)', async () => {
    renderWithProviders(<CustomerForm mode="create" onSaved={vi.fn()} />);

    submit();

    expect(await screen.findByText('Introduce el nombre.')).toBeVisible();
    expect(screen.getByText('Indica al menos un correo o un celular.')).toBeVisible();
    expect(
      screen.getByText('Confirma que el cliente autorizó el tratamiento de sus datos.')
    ).toBeVisible();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('registers the customer with the normalised data and notifies the screen (CA-24)', async () => {
    vi.mocked(createCustomer).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(<CustomerForm mode="create" onSaved={onSaved} />);

    type(/Nombre/, 'Marta Mostrador');
    type(/Celular/, '312 000 1111');
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
    submit();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createCustomer).toHaveBeenCalledWith({
      full_name: 'Marta Mostrador',
      email: null,
      phone: '3120001111',
      data_consent: true,
    });
  });

  it('shows the duplicate-email refusal (CA-26)', async () => {
    vi.mocked(createCustomer).mockResolvedValue({ ok: false, error: 'emailTaken' });
    renderWithProviders(<CustomerForm mode="create" onSaved={vi.fn()} />);

    type(/Nombre/, 'Marta');
    type(/Correo/, 'cliente@motorismo.test');
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
    submit();

    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeVisible();
  });
});

describe('CustomerForm (edit)', () => {
  afterEach(() => vi.clearAllMocks());

  const defaults = { full_name: 'Marta M.', email: 'marta@correo.test', phone: '3120001111' };
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  it('sends the changes of a customer without account, email included (CA-27)', async () => {
    vi.mocked(updateCustomer).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(
      <CustomerForm
        mode="edit"
        customerId="c-1"
        defaults={defaults}
        emailLocked={false}
        onSaved={onSaved}
      />
    );

    expect(screen.getByLabelText(/Celular/)).toHaveValue('312 000 1111');
    type(/Correo/, 'marta.m@correo.test');
    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateCustomer).toHaveBeenCalledWith({
      id: 'c-1',
      full_name: 'Marta M.',
      email: 'marta.m@correo.test',
      phone: '3120001111',
    });
  });

  it('shows the email of a customer with account as read-only, with the reason (CA-27, RN-10)', () => {
    renderWithProviders(
      <CustomerForm
        mode="edit"
        customerId="c-1"
        defaults={defaults}
        emailLocked
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('readonly');
    expect(
      screen.getByText('Es el correo con el que entra a su cuenta: no se puede cambiar.')
    ).toBeVisible();
  });
});
