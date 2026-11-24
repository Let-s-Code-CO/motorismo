/**
 * CustomersScreen — the staff list of customers, whose whole state (search, status card, page)
 * lives in the URL (spec 004, HU-04, CA-16 and CA-17).
 *
 * Guards (backlog debt: «a card pressed before the search reaches the URL»): the search waits
 * 300 ms after the last key before it goes to the URL. A summary card pressed meanwhile must not be
 * undone by that search, nor the search by the card's answer arriving late: each request builds on
 * the newest one asked for, not on what the page still shows. And a change from outside (the
 * «back» button) still shows its search in the box.
 *
 * The server is played by hand: `router.replace` only records the address, and the test renders
 * the screen again with the filters that address would bring, when the server would answer.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';
import CustomersScreen from '@web/modules/customers/components/organisms/customers-screen.component';
import type { CustomerFilters } from '@web/modules/customers/utils/customers-filter.utils';

import { renderWithProviders } from '@tests/test-utils/render';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/customers',
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock('@web/modules/customers/actions/customers.actions', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  setCustomerDisabled: vi.fn(),
}));

const COUNTS: Record<CustomerStatus, number> = { registered: 3, walk_in: 2, disabled: 1 };

const buildFilters = (overrides: Partial<CustomerFilters> = {}): CustomerFilters => ({
  q: '',
  status: null,
  page: 1,
  ...overrides,
});

const screenWith = (filters: CustomerFilters) => (
  <CustomersScreen filters={filters} rows={[]} matching={0} counts={COUNTS} />
);

/** The addresses asked for so far, in order. */
const asked = () => replace.mock.calls.map(([href]) => href as string);
const searchBox = () => screen.getByRole('searchbox', { name: 'Buscar clientes' });
const disabledCard = () => screen.getByRole('button', { name: /^Desactivados/ });

describe('CustomersScreen: search and status cards together', () => {
  // Only the search's wait is faked: HeroUI's own timers keep running.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('sends the search 300 ms after the last key, at page 1 (CA-16)', () => {
    renderWithProviders(screenWith(buildFilters({ page: 3 })));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(299));
    expect(asked()).toEqual([]);
    act(() => vi.advanceTimersByTime(1));

    expect(asked()).toEqual(['/customers?q=cam']);
  });

  it('keeps the card pressed while the search waits, when the card’s answer comes first', () => {
    const { rerender } = renderWithProviders(screenWith(buildFilters()));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(disabledCard());
    // The server answers the card before the search goes out.
    rerender(screenWith(buildFilters({ status: 'disabled' })));
    act(() => vi.advanceTimersByTime(200));

    expect(asked()).toEqual(['/customers?status=disabled', '/customers?q=cam&status=disabled']);
  });

  it('keeps the card pressed while the search waits, when the card’s answer is slower than the search', () => {
    renderWithProviders(screenWith(buildFilters()));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(disabledCard());
    // No answer yet: the page still shows every status when the search goes out.
    act(() => vi.advanceTimersByTime(200));

    expect(asked().at(-1)).toBe('/customers?q=cam&status=disabled');
  });

  it('keeps the typed search in the box when the card’s late answer arrives without it', () => {
    const { rerender } = renderWithProviders(screenWith(buildFilters()));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(disabledCard());
    act(() => vi.advanceTimersByTime(200));
    // The card's answer (no search yet) arrives after the search went out, then the search's.
    rerender(screenWith(buildFilters({ status: 'disabled' })));
    expect(searchBox()).toHaveValue('cam');
    rerender(screenWith(buildFilters({ status: 'disabled', q: 'cam' })));

    expect(searchBox()).toHaveValue('cam');
    expect(asked()).toHaveLength(2);
  });

  it('keeps what is being typed when the answer to an older search arrives late', () => {
    const { rerender } = renderWithProviders(screenWith(buildFilters()));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(searchBox(), { target: { value: 'camila' } });
    act(() => vi.advanceTimersByTime(300));
    // A slow network: «cam» comes back after «camila» went out.
    rerender(screenWith(buildFilters({ q: 'cam' })));

    expect(searchBox()).toHaveValue('camila');
    expect(asked()).toEqual(['/customers?q=cam', '/customers?q=camila']);
  });

  it('builds a card pressed after a search on that search, even before the page shows it', () => {
    renderWithProviders(screenWith(buildFilters()));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(disabledCard());

    expect(asked()).toEqual(['/customers?q=cam', '/customers?q=cam&status=disabled']);
  });

  it('shows the search of a change from outside, as the «back» button (CA-17)', () => {
    const { rerender } = renderWithProviders(
      screenWith(buildFilters({ q: 'cam', status: 'disabled' }))
    );

    rerender(screenWith(buildFilters({ q: 'val' })));

    expect(searchBox()).toHaveValue('val');
    fireEvent.click(disabledCard());
    // Built on what the page shows now: nothing of ours was on its way.
    expect(asked()).toEqual(['/customers?q=val&status=disabled']);
  });

  it('drops a search still on its way when the «back» button wins, and builds on what it brought', () => {
    const { rerender } = renderWithProviders(screenWith(buildFilters()));

    fireEvent.change(searchBox(), { target: { value: 'cam' } });
    act(() => vi.advanceTimersByTime(300));
    // «Atrás» before «cam» came back: the page shows the older search «val».
    rerender(screenWith(buildFilters({ q: 'val' })));
    fireEvent.click(disabledCard());

    expect(searchBox()).toHaveValue('val');
    expect(asked().at(-1)).toBe('/customers?q=val&status=disabled');
  });
});
