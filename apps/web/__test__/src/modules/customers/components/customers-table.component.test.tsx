/**
 * CustomersTable — the actions menu of each row of «Clientes» (spec 004, RN-09 / CA-32).
 *
 * Guards:
 * - CA-32: staff (operator or admin) open «Acciones de {nombre}» on a row and find «Desactivar
 *   cliente» for an active customer or «Reactivar cliente» for a disabled one; choosing it hands
 *   that customer to the screen, which runs the same action as the record (CA-29, CA-30). The menu
 *   mirrors «Usuarios» and will grow with more actions.
 * - the menu exists only where an action can run: without a handler there is no actions column.
 */
import { fireEvent, screen } from '@testing-library/react';

import type { CustomerListRow } from '@web/modules/customers/api/customers.server';
import CustomersTable from '@web/modules/customers/components/organisms/customers-table.component';

import { renderWithProviders } from '@tests/test-utils/render';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const row = (overrides: Partial<CustomerListRow> = {}): CustomerListRow => ({
  id: '10000000-0000-4000-8000-000000000001',
  full_name: 'Camila Cliente',
  email: 'cliente@motorismo.test',
  phone: '3001234567',
  status: 'registered',
  origin: 'self_signup',
  avatar_url: null,
  created_at: '2026-11-01T15:00:00.000Z',
  vehicle_plates: '',
  erased_at: null,
  ...overrides,
});

const renderTable = (customers: CustomerListRow[], onToggleAccess?: (c: CustomerListRow) => void) =>
  renderWithProviders(
    <CustomersTable
      customers={customers}
      query=""
      emptyLabel="Sin clientes"
      onToggleAccess={onToggleAccess}
    />
  );

describe('CustomersTable — row actions', () => {
  it('offers «Agendar» in the row menu of an active customer: «Nueva reserva» for them (spec 012, CA-42)', async () => {
    renderTable([row()], vi.fn());

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Camila Cliente' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Agendar' }));

    expect(push).toHaveBeenCalledWith('/agenda/new?customer=10000000-0000-4000-8000-000000000001');
  });

  it('offers no «Agendar» for a disabled customer (spec 012, CA-43)', async () => {
    renderTable([row({ full_name: 'Daniel Desactivado', status: 'disabled' })], vi.fn());

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Daniel Desactivado' }));

    await screen.findByRole('menuitem', { name: 'Reactivar cliente' });
    expect(screen.queryByRole('menuitem', { name: 'Agendar' })).not.toBeInTheDocument();
  });

  it('offers «Desactivar cliente» in the row menu of an active customer, and hands that customer over (CA-32)', async () => {
    const onToggleAccess = vi.fn();
    const camila = row();
    renderTable([camila], onToggleAccess);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Camila Cliente' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar cliente' }));

    expect(onToggleAccess).toHaveBeenCalledWith(camila);
    expect(screen.queryByRole('menuitem', { name: 'Reactivar cliente' })).not.toBeInTheDocument();
  });

  it('offers «Reactivar cliente» instead for a disabled customer (CA-32, CA-30)', async () => {
    const onToggleAccess = vi.fn();
    const daniel = row({
      id: '10000000-0000-4000-8000-000000000002',
      full_name: 'Daniel Desactivado',
      status: 'disabled',
    });
    renderTable([daniel], onToggleAccess);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Daniel Desactivado' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reactivar cliente' }));

    expect(onToggleAccess).toHaveBeenCalledWith(daniel);
  });

  it('draws no actions menu for an erased customer: nothing can change them (spec 017, RN-09)', () => {
    renderTable(
      [
        row({
          full_name: 'Cliente suprimido',
          status: 'disabled',
          erased_at: '2026-11-24T15:00:00Z',
        }),
      ],
      vi.fn()
    );

    expect(screen.queryByRole('button', { name: /^Acciones de/ })).not.toBeInTheDocument();
  });

  it('draws no actions menu when no action handler is given', () => {
    renderTable([row()]);

    expect(screen.queryByRole('button', { name: /^Acciones de/ })).not.toBeInTheDocument();
  });
});
