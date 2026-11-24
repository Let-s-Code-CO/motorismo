/**
 * DataRequestsScreen — «Solicitudes de datos», the admin's list (spec 017, CA-09).
 *
 * Guards: the pending ones first, the one due first on top, each with its customer, kind, channel,
 * received date and deadline, and the business days left («Faltan 4 días hábiles») or «Vencida»;
 * each opens its detail. The closed ones apart, with their state.
 */
import { screen, within } from '@testing-library/react';

import DataRequestsScreen from '@web/modules/data-rights/components/organisms/data-requests-screen.component';

import { renderWithProviders } from '@tests/test-utils/render';

import { buildDataRequest } from './admin-builders';

const REQUESTS = [
  buildDataRequest({ id: 'late', due_on: '2026-12-16', business_days_left: 15 }),
  buildDataRequest({
    id: 'overdue',
    kind: 'inquiry',
    channel: 'counter',
    customer_name: 'Valentina Vásquez',
    due_on: '2026-11-23',
    business_days_left: 0,
    overdue: true,
  }),
  buildDataRequest({ id: 'soon', due_on: '2026-11-30', business_days_left: 4 }),
  buildDataRequest({
    id: 'done',
    status: 'attended',
    resolved_at: '2026-11-20T15:00:00Z',
    response: 'Listo',
  }),
];

const items = (name: string) => within(screen.getByRole('list', { name })).getAllByRole('listitem');

describe('DataRequestsScreen', () => {
  it('puts the pending ones first, the one due first on top (CA-09)', () => {
    renderWithProviders(<DataRequestsScreen requests={REQUESTS} />);

    expect(
      items('Solicitudes pendientes').map((item) =>
        within(item).getByRole('link').getAttribute('href')
      )
    ).toEqual([
      '/admin/data-requests/overdue',
      '/admin/data-requests/soon',
      '/admin/data-requests/late',
    ]);
  });

  it('says of each its customer, kind, channel, dates and business days left, or «Vencida» (CA-09)', () => {
    renderWithProviders(<DataRequestsScreen requests={REQUESTS} />);

    const [overdue, soon] = items('Solicitudes pendientes');
    expect(overdue).toHaveTextContent('Consulta · Valentina Vásquez');
    expect(overdue).toHaveTextContent('Punto de atención · Recibida el 24 nov 2026');
    expect(overdue).toHaveTextContent('Vence el 23 nov 2026');
    expect(overdue).toHaveTextContent('Vencida');
    expect(soon).toHaveTextContent('Corrección · Camila Cliente');
    expect(soon).toHaveTextContent('Desde la app');
    expect(soon).toHaveTextContent('Faltan 4 días hábiles');
  });

  it('keeps the closed ones apart, with their state (CA-09)', () => {
    renderWithProviders(<DataRequestsScreen requests={REQUESTS} />);

    const [done] = items('Solicitudes cerradas');
    expect(done).toHaveTextContent('Atendida');
    expect(items('Solicitudes cerradas')).toHaveLength(1);
  });

  it('says when nothing is pending', () => {
    renderWithProviders(<DataRequestsScreen requests={[]} />);

    expect(screen.getByText('No hay solicitudes pendientes.')).toBeVisible();
  });
});
