/**
 * CustomerContactCard — the "Datos de contacto" card of a customer record, where staff correct the
 * customer's data (spec 004, CA-18 / CA-27).
 *
 * Guards:
 * - CA-18: the card shows the email and the phone (or "—" when missing).
 * - CA-27: editing starts from an icon button in the card itself ("Editar datos", named for screen
 *   readers), opens the edit form in a dialog with the current data, and a saved change closes the
 *   dialog and is announced inside the card.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { updateCustomer } from '@web/modules/customers/actions/customers.actions';
import CustomerContactCard from '@web/modules/customers/components/organisms/customer-contact-card.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/customers/actions/customers.actions', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));

type Contact = Parameters<typeof CustomerContactCard>[0]['customer'];

const buildContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c-1',
  full_name: 'Marta Mostrador',
  email: 'marta@correo.test',
  phone: '3120001111',
  user_id: null,
  erased_at: null,
  ...overrides,
});

const card = () => screen.getByRole('region', { name: 'Datos de contacto' });

describe('CustomerContactCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the email and the formatted phone, or "—" when one is missing (CA-18)', () => {
    renderWithProviders(<CustomerContactCard customer={buildContact({ phone: null })} />);

    expect(within(card()).getByText('marta@correo.test')).toBeVisible();
    expect(within(card()).getByText('—')).toBeVisible();
  });

  it('offers no editing for an erased customer: nothing can change them (spec 017, RN-09)', () => {
    renderWithProviders(
      <CustomerContactCard
        customer={buildContact({
          full_name: 'Cliente suprimido',
          email: null,
          phone: null,
          erased_at: '2026-11-24T15:00:00Z',
        })}
      />
    );

    expect(within(card()).queryByRole('button', { name: 'Editar datos' })).not.toBeInTheDocument();
  });

  it('offers editing as an icon button inside the contact card, not as a section of its own (CA-27)', () => {
    renderWithProviders(<CustomerContactCard customer={buildContact()} />);

    const edit = within(card()).getByRole('button', { name: 'Editar datos' });
    // Icon only: the name comes from aria-label, there is no visible text.
    expect(edit).toHaveTextContent('');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the edit form in a dialog with the current data (CA-27)', async () => {
    renderWithProviders(<CustomerContactCard customer={buildContact()} />);

    fireEvent.click(within(card()).getByRole('button', { name: 'Editar datos' }));

    const dialog = await screen.findByRole('dialog', { name: /^Editar datos/ });
    expect(within(dialog).getByLabelText(/Nombre completo/)).toHaveValue('Marta Mostrador');
    expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('closes the dialog, refreshes the record and announces the change in a floating notice once saved (CA-27; spec 013, CA-01)', async () => {
    vi.mocked(updateCustomer).mockResolvedValue({ ok: true });
    renderWithProviders(<CustomerContactCard customer={buildContact()} />);
    // Taken before opening: while the dialog is open it hides the page from assistive technologies.
    const contact = card();

    fireEvent.click(within(contact).getByRole('button', { name: 'Editar datos' }));
    const dialog = await screen.findByRole('dialog', { name: /^Editar datos/ });
    fireEvent.change(within(dialog).getByLabelText(/Nombre completo/), {
      target: { value: 'Marta M.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(await inToasts().findByText('Datos del cliente guardados.')).toBeInTheDocument();
    expect(within(contact).queryByText('Datos del cliente guardados.')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(updateCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c-1', full_name: 'Marta M.' })
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
