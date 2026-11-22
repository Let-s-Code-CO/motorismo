/**
 * ShopOrderCard — one of the customer's vehicles in the shop (spec 014, HU-01).
 *
 * Guards:
 * - CA-01: in the queue it says «En cola», how many orders go before («Van 2 antes», «Eres el
 *   siguiente»), the services and since when it is there.
 * - CA-02: in progress it says since when and «Lista hacia…» only when every service has a time;
 *   otherwise «Sin hora estimada».
 * Which vehicle it is: brand, line and plate.
 */
import { screen } from '@testing-library/react';

import ShopOrderCard from '@web/modules/customer-area/components/molecules/shop-order-card.component';
import type { ShopOrder } from '@web/modules/customer-area/types/customer-area.types';

import { renderWithProviders } from '@tests/test-utils/render';

const order = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 'o1',
  number: 4,
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  opened_at: '2030-06-12T08:30:00-05:00',
  started_at: null,
  lines: [
    { name: 'Lavado detallado', estimated_minutes: 45 },
    { name: 'Limpieza de cadena', estimated_minutes: 15 },
  ],
  ahead: 2,
  ...overrides,
});

describe('ShopOrderCard', () => {
  it('says it is in the queue, how many go before, the services and since when (CA-01)', () => {
    renderWithProviders(<ShopOrderCard order={order()} />);

    expect(screen.getByText('En cola')).toBeVisible();
    expect(screen.getByText('Van 2 antes')).toBeVisible();
    expect(screen.getByText('En el lavadero desde las 8:30 a. m.')).toBeVisible();
    expect(screen.getByText('Lavado detallado · Limpieza de cadena')).toBeVisible();
    expect(screen.getByText('Suzuki GSX-R600 · UIH-03D')).toBeVisible();
    expect(screen.queryByText(/Lista hacia/)).not.toBeInTheDocument();
  });

  it.each([
    [1, 'Va 1 antes'],
    [0, 'Eres el siguiente'],
  ])('with %i before it says «%s» (CA-01)', (ahead, text) => {
    renderWithProviders(<ShopOrderCard order={order({ ahead })} />);

    expect(screen.getByText(text)).toBeVisible();
  });

  it('in progress says since when and when it should be ready: 9:00 + 45 + 15 min = 10:00 (CA-02)', () => {
    renderWithProviders(
      <ShopOrderCard order={order({ started_at: '2030-06-12T09:00:00-05:00', ahead: null })} />
    );

    expect(screen.getByText('En proceso')).toBeVisible();
    expect(screen.getByText('Empezó a las 9:00 a. m.')).toBeVisible();
    expect(screen.getByText('Lista hacia las 10:00 a. m.')).toBeVisible();
    expect(screen.queryByText(/antes/)).not.toBeInTheDocument();
  });

  it('gives no time when a service has none: «Sin hora estimada» (CA-02)', () => {
    renderWithProviders(
      <ShopOrderCard
        order={order({
          started_at: '2030-06-12T09:00:00-05:00',
          ahead: null,
          lines: [
            { name: 'Lavado detallado', estimated_minutes: 45 },
            { name: 'Otro', estimated_minutes: null },
          ],
        })}
      />
    );

    expect(screen.getByText('Sin hora estimada')).toBeVisible();
    expect(screen.queryByText(/Lista hacia/)).not.toBeInTheDocument();
  });
});
