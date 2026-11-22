/**
 * NewOrderScreen — «Nueva orden» when the customer arrives for a reservation (spec 012, HU-03).
 *
 * Guards:
 * - CA-12: the reservation's customer comes already chosen and fixed (CA-19: the reservation is
 *   theirs), its vehicle is the one to choose, and the editor gets the reservation (its services and
 *   sending it on save, CA-13).
 * - If the vehicle already has an order open, its link carries the reservation, so that order takes
 *   it (assumption of the spec).
 * - Without a reservation, the screen is as in spec 008: no customer chosen yet.
 * The picker, the history and the editor have their own tests: here they report what they get.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { screen } from '@testing-library/react';

import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import NewOrderScreen from '@web/modules/work-orders/components/organisms/new-order-screen.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@web/modules/work-orders/api/work-orders.client', () => ({
  fetchCustomerOrders: vi.fn().mockResolvedValue([]),
}));
vi.mock('@web/modules/work-orders/components/organisms/customer-history.component', () => ({
  default: () => null,
}));
vi.mock('@web/modules/work-orders/components/organisms/customer-picker.component', () => ({
  default: (props: {
    customer: { full_name: string } | null;
    customerLocked?: boolean;
    initialVehicleId?: string | null;
    openOrderQuery?: string;
  }) => (
    <dl>
      <dt>Cliente</dt>
      <dd>{props.customer?.full_name ?? 'ninguno'}</dd>
      <dt>Fijo</dt>
      <dd>{props.customerLocked ? 'sí' : 'no'}</dd>
      <dt>Vehículo inicial</dt>
      <dd>{props.initialVehicleId ?? 'ninguno'}</dd>
      <dt>Enlace a la orden abierta</dt>
      <dd>{props.openOrderQuery || 'sin reserva'}</dd>
    </dl>
  ),
}));

const reservation = {
  id: 'r9',
  status: 'pending',
  customer_id: 'customer-1',
  customer_name: 'Camila Cliente',
  customer_phone: '3001234567',
  vehicle_id: 'vehicle-1',
  service_ids: ['service-1'],
  services: ['Lavado detallado'],
  slot_start: '2030-06-12T14:00:00Z',
} as ReservationSummary;

const renderScreen = (props: { reservation?: ReservationSummary } = {}) =>
  renderWithProviders(
    (
      <QueryClientProvider client={new QueryClient()}>
        <NewOrderScreen {...props} />
      </QueryClientProvider>
    ) as ReactNode as never
  );

const value = (term: string) => screen.getByText(term).nextElementSibling?.textContent;

describe('NewOrderScreen', () => {
  it('starts from the reservation: its customer chosen and fixed, its vehicle to choose (CA-12, CA-19)', () => {
    renderScreen({ reservation });

    expect(value('Cliente')).toBe('Camila Cliente');
    expect(value('Fijo')).toBe('sí');
    expect(value('Vehículo inicial')).toBe('vehicle-1');
    expect(value('Enlace a la orden abierta')).toBe('?reservation=r9');
  });

  it('without a reservation, chooses nobody yet (spec 008)', () => {
    renderScreen();

    expect(value('Cliente')).toBe('ninguno');
    expect(value('Fijo')).toBe('no');
    expect(value('Vehículo inicial')).toBe('ninguno');
    expect(value('Enlace a la orden abierta')).toBe('sin reserva');
  });
});
