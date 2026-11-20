/**
 * OrderDetail — one order, in full (spec 008, CA-20).
 *
 * Guards:
 * - CA-20: services with their employees and shares, subtotal, discount and total, payments, who
 *   received and handed it over and when; open, it can be edited or closed.
 * - CA-29: an open order shows its estimate and ready time.
 * - CA-14: a closed order offers no edit nor close.
 * - CA-21 to CA-23 / RN-05: staff void an open order; on a closed one only an admin sees «Corregir»
 *   and «Anular»; a voided or corrected order says by whom, when and why.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { screen } from '@testing-library/react';

import OrderDetail from '@web/modules/work-orders/components/organisms/order-detail.component';
import type { WorkOrderDetail } from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@web/modules/work-orders/actions/work-orders.actions', () => ({
  saveWorkOrder: vi.fn(),
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
    brand_name: 'Suzuki',
    line_name: 'GSX-R600',
    notes: 'Trae un rayón en el tanque',
    opened_at: '2026-11-17T15:00:00Z',
    opened_by_name: 'Óscar Operador',
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
    expect(screen.getByText('Trae un rayón en el tanque')).toBeVisible();
  });

  it('offers no edit nor close on a closed order (CA-14)', () => {
    renderDetail(detail());

    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar y cobrar' })).not.toBeInTheDocument();
  });

  it('offers to edit or close an open order, with its estimate (CA-08, CA-29)', () => {
    renderDetail(
      detail({
        status: 'open',
        closed_at: null,
        closed_by_name: null,
        opened_at: '2026-11-20T19:00:00Z',
      })
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar y cobrar' })).toBeVisible();
    // 150 minutes after 2:00 p. m.
    expect(screen.getByRole('region', { name: 'Resumen de la orden' })).toHaveTextContent(
      '≈ 2 h 30 min · lista hacia las 4:30 p. m.'
    );
  });

  it('lets staff void an open order (CA-21)', () => {
    renderDetail(detail({ status: 'open', closed_at: null, closed_by_name: null }));

    expect(screen.getByRole('button', { name: 'Anular' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
  });

  it('offers an admin to correct or void a closed order, and an operator nothing (CA-22, CA-23, RN-05)', () => {
    const { unmount } = renderDetail(detail(), true);
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Anular' })).toBeVisible();
    unmount();

    renderDetail(detail(), false);
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument();
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
});
