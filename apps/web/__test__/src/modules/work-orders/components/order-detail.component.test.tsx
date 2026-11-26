/**
 * OrderDetail — one order, in full (spec 008, CA-20).
 *
 * Guards:
 * - CA-20: services with their employees and shares, subtotal, discount and total, payments, who
 *   received and handed it over and when; open, it can be edited or closed.
 * - CA-29: an open order shows its estimate and ready time.
 * - CA-14: a closed order offers no edit nor close.
 * - The vehicle shows its plate drawn like a Colombian plate, as on the customer record (spec 005):
 *   a car's with its city, a motorcycle's with COLOMBIA, a bicycle «Sin placa».
 * - CA-21 to CA-23 / RN-05: staff void an open order; on a closed one only an admin sees «Corregir»
 *   and «Anular orden» (in its own section at the end); a voided or corrected order says by whom, when and why.
 * - HU-07: an order in the queue offers «Empezar» and shows only its duration; once started it says
 *   by whom and when, and its ready time counts from then (CA-33, CA-34).
 * - Spec 024, CA-04: a motorcycle's card says its category (or «Sin categoría»); other vehicles none.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen, within } from '@testing-library/react';

import { startWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import { fetchVehicleCategory } from '@web/modules/work-orders/api/work-orders.client';
import OrderDetail from '@web/modules/work-orders/components/organisms/order-detail.component';
import type { WorkOrderDetail } from '@web/modules/work-orders/types/work-orders.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@web/modules/work-orders/api/work-orders.client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchVehicleCategory: vi.fn().mockResolvedValue('sbk'),
}));
vi.mock('@web/modules/work-orders/actions/work-orders.actions', () => ({
  saveWorkOrder: vi.fn(),
  startWorkOrder: vi.fn(),
  closeWorkOrder: vi.fn(),
  voidWorkOrder: vi.fn(),
  correctWorkOrder: vi.fn(),
}));

const detail = (overrides: Partial<WorkOrderDetail['summary']> = {}): WorkOrderDetail => ({
  summary: {
    id: 'o2',
    number: 2,
    status: 'closed',
    customer_id: 'c1',
    customer_name: 'Camila Cliente',
    vehicle_id: 'v1',
    vehicle_type: 'motorcycle',
    plate: 'UIH03D',
    plate_city_name: null,
    brand_name: 'Suzuki',
    line_name: 'GSX-R600',
    notes: 'Trae un rayón en el tanque',
    opened_at: '2026-11-17T15:00:00Z',
    opened_by_name: 'Óscar Operador',
    started_at: null,
    started_by_name: null,
    closed_at: '2026-11-17T18:00:00Z',
    closed_by_name: 'Sebastián Pulido',
    voided_at: null,
    voided_by_name: null,
    void_reason: null,
    corrected_at: null,
    corrected_by_name: null,
    correction_reason: null,
    subtotal: 145000,
    discount: 5000,
    total: 140000,
    estimated_minutes: 150,
    unestimated: [],
    services: ['Lavado sencillo', 'Micropulido'],
    ...overrides,
  } as WorkOrderDetail['summary'],
  lines: [
    {
      id: 'l1',
      position: 1,
      service_id: 's1',
      name: 'Lavado sencillo',
      price: 25000,
      estimated_minutes: 30,
      employees: [{ employee_id: 'e2', full_name: 'Paula Pineda', share_pct: 100 }],
    },
    {
      id: 'l2',
      position: 2,
      service_id: 's2',
      name: 'Micropulido',
      price: 120000,
      estimated_minutes: 120,
      employees: [
        { employee_id: 'e1', full_name: 'Elkin Estrada', share_pct: 80 },
        { employee_id: 'e2', full_name: 'Paula Pineda', share_pct: 20 },
      ],
    },
  ],
  payments: [
    { method: 'cash', amount: 100000 },
    { method: 'transfer', amount: 40000 },
  ],
});

const renderDetail = (order: WorkOrderDetail, isAdmin = false) =>
  renderWithProviders(
    (
      <QueryClientProvider client={new QueryClient()}>
        <OrderDetail order={order} isAdmin={isAdmin} />
      </QueryClientProvider>
    ) as ReactNode as never
  );

describe('OrderDetail', () => {
  it('shows the whole order: services, employees and shares, totals, payments and who (CA-20)', () => {
    renderDetail(detail());

    expect(screen.getByRole('heading', { name: 'Orden #2' })).toBeVisible();
    expect(screen.getByText('Elkin Estrada (80 %) · Paula Pineda (20 %)')).toBeVisible();
    const summary = screen.getByRole('region', { name: 'Resumen de la orden' });
    expect(summary).toHaveTextContent('Subtotal$ 145.000');
    expect(summary).toHaveTextContent('Descuento$ 5.000');
    expect(summary).toHaveTextContent('Total$ 140.000');
    expect(screen.getByText('Efectivo')).toBeVisible();
    expect(screen.getByText('Transferencia')).toBeVisible();
    expect(
      screen.getByText(/Recibido el 17 de noviembre de 2026.* por Óscar Operador/)
    ).toBeVisible();
    expect(
      screen.getByText(/Entregado el 17 de noviembre de 2026.* por Sebastián Pulido/)
    ).toBeVisible();
    // The notes say what they are: labelled «Observaciones».
    const notes = screen.getByText('Trae un rayón en el tanque');
    expect(notes).toBeVisible();
    expect(notes.tagName).toBe('DD');
    expect(notes.closest('dl')!.querySelector('dt')).toHaveTextContent('Observaciones');
  });

  it('offers no edit nor close on a closed order (CA-14)', () => {
    renderDetail(detail());

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar y cobrar' })).not.toBeInTheDocument();
  });

  it('offers to start an order in the queue, showing only its duration (CA-33, RN-12)', () => {
    renderDetail(detail({ status: 'open', closed_at: null, closed_by_name: null }));

    expect(screen.getByText('En cola')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar y cobrar' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Resumen de la orden' })).toHaveTextContent(
      '≈ 2 h 30 min'
    );
    expect(screen.getByRole('region', { name: 'Resumen de la orden' })).not.toHaveTextContent(
      'lista hacia'
    );
  });

  it('says the order started in a floating notice (CA-33; spec 013, CA-01)', async () => {
    vi.mocked(startWorkOrder).mockResolvedValue({ ok: true });
    renderDetail(detail({ status: 'open', closed_at: null, closed_by_name: null }));

    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    expect(await inToasts().findByText('Orden en proceso.')).toBeVisible();
  });

  it('says why it could not start as an error that stays, not as a confirmation (spec 013, CA-07)', async () => {
    vi.mocked(startWorkOrder).mockResolvedValue({ ok: false, error: 'alreadyStarted' });
    renderDetail(detail({ status: 'open', closed_at: null, closed_by_name: null }));

    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));

    const error = await inToasts().findByText('Esta orden ya está en proceso.');
    expect(error.closest('[data-toast]')).toHaveAttribute('data-toast', 'danger');
  });

  it('shows who started an order in progress, and its ready time from the start (CA-33, CA-34)', () => {
    renderDetail(
      detail({
        status: 'open',
        closed_at: null,
        closed_by_name: null,
        started_at: '2026-11-20T19:00:00Z',
        started_by_name: 'Paula Pineda',
      })
    );

    expect(screen.getByText('En proceso')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Empezar' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Empezada el 20 de noviembre de 2026.* por Paula Pineda/)
    ).toBeVisible();
    // 150 minutes after 2:00 p. m.
    expect(screen.getByRole('region', { name: 'Resumen de la orden' })).toHaveTextContent(
      '≈ 2 h 30 min · lista hacia las 4:30 p. m.'
    );
  });

  it('lets staff void an open order from its own «Anulación» section, like «Desactivar cliente» (CA-21)', () => {
    renderDetail(detail({ status: 'open', closed_at: null, closed_by_name: null }));

    // Away from the day-to-day actions at the top, so nobody voids an order by mistake, and a solid
    // red button because it is destructive (as on the customer record).
    const voiding = screen.getByRole('region', { name: 'Anulación' });
    expect(voiding).toHaveTextContent('deja de contar en el historial y los totales');
    const button = within(voiding).getByRole('button', { name: 'Anular orden' });
    expect(button).toBeVisible();
    expect(button).toHaveClass('bg-danger-600');
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
  });

  it('offers an admin to correct or void a closed order, and an operator nothing (CA-22, CA-23, RN-05)', () => {
    const { unmount } = renderDetail(detail(), true);
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Anular orden' })).toBeVisible();
    unmount();

    renderDetail(detail(), false);
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Anulación' })).not.toBeInTheDocument();
  });

  it('says who voided an order, when and why, and offers nothing more (CA-21, CA-23)', () => {
    renderDetail(
      detail({
        status: 'voided',
        voided_at: '2026-11-18T15:00:00Z',
        voided_by_name: 'Sebastián Pulido',
        void_reason: 'Orden duplicada',
      }),
      true
    );

    expect(
      screen.getByText(/Anulada el 18 de noviembre de 2026.* por Sebastián Pulido: Orden duplicada/)
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Anulación' })).not.toBeInTheDocument();
  });

  it('says who corrected an order, when and why (CA-22)', () => {
    renderDetail(
      detail({
        corrected_at: '2026-11-18T15:00:00Z',
        corrected_by_name: 'Sebastián Pulido',
        correction_reason: 'Se cobró de más',
      })
    );

    expect(
      screen.getByText(
        /Corregida el 18 de noviembre de 2026.* por Sebastián Pulido: Se cobró de más/
      )
    ).toBeVisible();
  });

  it('draws the plate as on the customer record: COLOMBIA for a motorcycle, the city for a car', () => {
    const { unmount } = renderDetail(detail());
    expect(screen.getByRole('img', { name: 'Motocicleta' })).toBeVisible();
    expect(screen.getByText('Suzuki GSX-R600')).toBeVisible();
    expect(screen.getByText('UIH-03D')).toBeVisible();
    const legend = () => document.querySelector<HTMLElement>('[data-plate]')?.dataset.legend;
    expect(legend()).toBe('COLOMBIA');
    unmount();

    renderDetail(
      detail({
        vehicle_type: 'car',
        plate: 'KDM482',
        plate_city_name: 'Bogotá, D.C.',
        brand_name: 'Mazda',
        line_name: 'CX-30',
      })
    );
    // Read aloud with its city; drawn with the city below.
    expect(screen.getByText('KDM-482')).toHaveTextContent('KDM-482, Bogotá, D.C.');
    // Spec 023, RN-05: as plates are stamped, without accents.
    expect(legend()).toBe('BOGOTA, D.C.');
    expect(screen.getByRole('img', { name: 'Carro' })).toBeVisible();
  });

  it('says «Sin placa» and shows the bicycle icon for a bicycle', () => {
    renderDetail(
      detail({ vehicle_type: 'bicycle', plate: null, brand_name: 'GW', line_name: null })
    );

    expect(screen.getByText('Sin placa')).toBeVisible();
    expect(screen.getByRole('img', { name: 'Bicicleta' })).toBeVisible();
  });

  it('links to the reservation it came from (spec 012, RF-04)', () => {
    // 9:00 a. m. in Bogotá.
    renderDetail(detail({ reservation_id: 'r9', reserved_start: '2030-06-12T14:00:00Z' }));

    expect(
      screen.getByRole('link', { name: 'Viene de la reserva de las 9:00 a. m.' })
    ).toHaveAttribute('href', '/agenda/r9');
  });

  it('opens editing to take the reservation of a customer whose vehicle already had it open (spec 012)', () => {
    renderWithProviders(
      (
        <QueryClientProvider client={new QueryClient()}>
          <OrderDetail
            order={detail({ status: 'open', started_at: null })}
            isAdmin={false}
            reservation={{
              id: 'r9',
              service_ids: [],
              services: [],
              service_minutes: [],
              slot_start: '2030-06-12T14:00:00Z',
            }}
          />
        </QueryClientProvider>
      ) as ReactNode as never
    );

    expect(
      screen.getByText('Al guardar, esta orden queda enlazada a la reserva de las 9:00 a. m.')
    ).toBeVisible();
  });

  describe('the category of the motorcycle (spec 024, CA-04)', () => {
    /** The card's description list: what came in and whose it is. */
    const vehicleCard = () => screen.getByText('Suzuki GSX-R600').closest('dl')!;

    it('says the category of a motorcycle', async () => {
      vi.mocked(fetchVehicleCategory).mockResolvedValue('sbk');
      renderDetail(detail());

      expect(await within(vehicleCard()).findByText('SBK/SSP')).toBeVisible();
      expect(fetchVehicleCategory).toHaveBeenCalledWith('v1');
    });

    it('says «Sin categoría» for a motorcycle without one', async () => {
      vi.mocked(fetchVehicleCategory).mockResolvedValue(null);
      renderDetail(detail());

      expect(await within(vehicleCard()).findByText('Sin categoría')).toBeVisible();
    });

    it('says nothing of it for a car', () => {
      vi.mocked(fetchVehicleCategory).mockClear();
      renderDetail(
        detail({
          vehicle_type: 'car',
          brand_name: 'Suzuki',
          line_name: 'GSX-R600',
          plate: 'KDM482',
        })
      );

      expect(within(vehicleCard()).queryByText('Sin categoría')).not.toBeInTheDocument();
      expect(fetchVehicleCategory).not.toHaveBeenCalled();
    });
  });
});
