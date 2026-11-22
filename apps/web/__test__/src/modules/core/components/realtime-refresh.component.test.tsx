/**
 * RealtimeRefresh — keeps the staff screens up to date without reloading (spec 012, HU-06, CA-35).
 *
 * Guards:
 * - It listens to the changes of orders, reservations and the agenda (Realtime only sends what the
 *   person may read: staff).
 * - A change refreshes the screen's data from the server; a burst of changes (one order saved
 *   touches several rows) refreshes once, half a second after the last one.
 * - Coming back to the tab refreshes too (changes may have happened while it was hidden).
 * - It stops listening when it goes away.
 * - Only the screens that show orders or reservations refresh (CA-35: home, «Órdenes» and an order,
 *   «Agenda» and a reservation): every refresh asks the server again for the page and its links,
 *   which on «Clientes» or «Servicios» would cost requests and show nothing new.
 * The refresh keeps what is on the client (what is being typed, open dialogs): it is Next's
 * `router.refresh()`.
 */
import { act, render } from '@testing-library/react';

import RealtimeRefresh from '@web/modules/core/components/realtime-refresh.component';
import { createSupabaseBrowserClient } from '@web/modules/core/lib/supabase-browser.lib';

const refresh = vi.fn();
let pathname = '/orders';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }), usePathname: () => pathname }));
vi.mock('@web/modules/core/lib/supabase-browser.lib', () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

/** A Realtime channel that records what it listens to and lets the test send changes. */
const fakeRealtime = () => {
  const listened: string[] = [];
  const handlers: (() => void)[] = [];
  const channel = {
    on: vi.fn((_type: string, filter: { table: string }, handler: () => void) => {
      listened.push(filter.table);
      handlers.push(handler);
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };
  const removeChannel = vi.fn();
  vi.mocked(createSupabaseBrowserClient).mockReturnValue({
    channel: () => channel,
    removeChannel,
  } as never);
  return { listened, change: () => handlers[0]!(), removeChannel, channel };
};

describe('RealtimeRefresh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    pathname = '/orders';
  });

  it('listens to orders, reservations and the agenda (CA-35)', () => {
    const realtime = fakeRealtime();
    render(<RealtimeRefresh />);

    expect(realtime.listened.sort()).toEqual([
      'agenda_days',
      'agenda_settings',
      'agenda_weeks',
      'reservations',
      'work_orders',
    ]);
    expect(realtime.channel.subscribe).toHaveBeenCalled();
  });

  it('refreshes once, half a second after a burst of changes (CA-35)', () => {
    const realtime = fakeRealtime();
    render(<RealtimeRefresh />);

    realtime.change();
    realtime.change();
    realtime.change();
    act(() => vi.advanceTimersByTime(499));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the person comes back to the tab', () => {
    fakeRealtime();
    render(<RealtimeRefresh />);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(500);
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops listening when it goes away', () => {
    const realtime = fakeRealtime();
    const { unmount } = render(<RealtimeRefresh />);

    unmount();

    expect(realtime.removeChannel).toHaveBeenCalledWith(realtime.channel);
  });

  it.each(['/', '/orders', '/orders/abc', '/agenda', '/agenda/abc'])(
    'refreshes %s, which shows orders or reservations (CA-35)',
    (path) => {
      pathname = path;
      const realtime = fakeRealtime();
      render(<RealtimeRefresh />);

      realtime.change();
      act(() => vi.advanceTimersByTime(500));

      expect(refresh).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['/customers', '/services', '/employees', '/users', '/customers/abc'])(
    'leaves %s alone, which shows neither: no requests for nothing (CA-35)',
    (path) => {
      pathname = path;
      const realtime = fakeRealtime();
      render(<RealtimeRefresh />);

      realtime.change();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
        vi.advanceTimersByTime(500);
      });

      expect(refresh).not.toHaveBeenCalled();
    }
  );
});
