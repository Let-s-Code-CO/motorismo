/**
 * CustomerManage — what staff can do on a customer record (spec 004, HU-06 / HU-07).
 *
 * Guards:
 * - CA-27: editing is NOT a section here any more: it opens from the contact card
 *   (customer-contact-card).
 * - CA-31 / RN-09: every staff member — operator or admin — sees "Desactivar cliente" /
 *   "Reactivar cliente" (the record is a staff-only page); a customer never reaches it.
 * - CA-29 / CA-30: staff disable an enabled customer and reactivate a disabled one, and the
 *   result is announced as a floating notice (spec 013, CA-01); a refusal too, and it stays until
 *   closed (spec 013, CA-07); with no network, nothing is said but the app's «Sin conexión»
 *   (spec 013, CA-09).
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { setCustomerDisabled } from '@web/modules/customers/actions/customers.actions';
import type { CustomerRecord } from '@web/modules/customers/api/customers.server';
import CustomerDetail from '@web/modules/customers/components/organisms/customer-detail.component';
import CustomerManage from '@web/modules/customers/components/organisms/customer-manage.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@web/modules/customers/actions/customers.actions', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  setCustomerDisabled: vi.fn(),
}));

const customer = {
  id: 'c-1',
  full_name: 'Camila Cliente',
  email: 'cliente@motorismo.test',
  phone: '3001234567',
  user_id: 'u-1',
  disabled_at: null,
};

describe('CustomerManage', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers any staff member "Desactivar cliente", and no edit section of its own (RN-09, CA-31; editing lives in the contact card, CA-27)', () => {
    renderWithProviders(<CustomerManage customer={customer} />);

    expect(screen.queryByRole('button', { name: 'Editar datos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desactivar cliente' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Reactivar cliente' })).not.toBeInTheDocument();
  });

  it('lets staff disable an enabled customer and announces it (CA-29)', async () => {
    vi.mocked(setCustomerDisabled).mockResolvedValue({ ok: true });
    renderWithProviders(<CustomerManage customer={customer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar cliente' }));

    expect(
      await inToasts().findByText(
        'Cliente desactivado. Si tiene una sesión abierta, se cerrará en su siguiente acción.'
      )
    ).toBeVisible();
    expect(setCustomerDisabled).toHaveBeenCalledWith({ id: 'c-1', disabled: true });
  });

  it('offers staff to reactivate a disabled customer (CA-30)', async () => {
    vi.mocked(setCustomerDisabled).mockResolvedValue({ ok: true });
    renderWithProviders(
      <CustomerManage customer={{ ...customer, disabled_at: '2026-11-19T10:00:00Z' }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reactivar cliente' }));

    expect(await inToasts().findByText('Cliente reactivado.')).toBeVisible();
    expect(setCustomerDisabled).toHaveBeenCalledWith({ id: 'c-1', disabled: false });
  });

  it('says a refusal in a floating notice (spec 013, CA-07)', async () => {
    vi.mocked(setCustomerDisabled).mockResolvedValue({ ok: false, error: 'generic' });
    renderWithProviders(<CustomerManage customer={customer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar cliente' }));

    expect(await inToasts().findByText('Algo salió mal. Inténtalo de nuevo.')).toBeVisible();
  });

  it('says nothing of its own with no network (spec 013, CA-09)', async () => {
    vi.mocked(setCustomerDisabled).mockRejectedValue(new TypeError('Failed to fetch'));
    renderWithProviders(<CustomerManage customer={customer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar cliente' }));

    await waitFor(() => expect(setCustomerDisabled).toHaveBeenCalled());
    expect(screen.getByRole('region', { name: 'Avisos' })).toHaveTextContent('');
    expect(screen.queryByText(/No se pudo/)).not.toBeInTheDocument();
  });
});

describe('CustomerDetail — «Agendar» (spec 012, amendment HU-07)', () => {
  const record = (overrides: Partial<CustomerRecord> = {}) =>
    ({
      ...customer,
      status: 'registered',
      origin: 'self_signup',
      avatar_url: null,
      created_at: '2026-11-01T15:00:00Z',
      consent_at: '2026-11-01T15:00:00Z',
      registrar_name: null,
      vehicle_plates: '',
      ...overrides,
    }) as CustomerRecord;

  it('offers «Agendar» for an active customer: «Nueva reserva» with them (CA-40)', () => {
    renderWithProviders(<CustomerDetail customer={record()}>{null}</CustomerDetail>);

    expect(
      // HeroUI buttons rendered as links keep the button role; what matters is where they lead.
      screen.getByRole('button', { name: 'Agendar' })
    ).toHaveAttribute('href', '/agenda/new?customer=c-1');
  });

  it('offers no «Agendar» for a disabled customer (CA-43)', () => {
    renderWithProviders(
      <CustomerDetail
        customer={record({ disabled_at: '2026-11-19T10:00:00Z', status: 'disabled' })}
      >
        {null}
      </CustomerDetail>
    );

    expect(screen.queryByRole('button', { name: 'Agendar' })).not.toBeInTheDocument();
  });
});
