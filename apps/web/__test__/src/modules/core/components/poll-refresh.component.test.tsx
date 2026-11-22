/**
 * PollRefresh — keeps a customer's screen up to date without reloading (spec 014, CA-05, CA-22): their
 * vehicle in the shop and their reservations change when staff start or close an order, move the
 * queue or give more time to arrive.
 *
 * Guards:
 * - It asks the server again every 15 s while the tab is visible, and right when the person comes
 *   back to it (the time it was hidden may have changed everything).
 * - A hidden tab asks nothing: no requests for a screen nobody looks at.
 * - It stops when it goes away.
 * The refresh keeps what is on the client (Next's `router.refresh()`).
 */
import { act, render } from '@testing-library/react';

import PollRefresh from '@web/modules/core/components/poll-refresh.component';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const setVisibility = (state: 'visible' | 'hidden') =>
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

describe('PollRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('refreshes every 15 seconds while the tab is visible (CA-05, CA-22)', () => {
    render(<PollRefresh />);

    act(() => vi.advanceTimersByTime(14_999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(15_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('asks nothing while the tab is hidden, and refreshes when the person comes back', () => {
    render(<PollRefresh />);

    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);
    });
    expect(refresh).not.toHaveBeenCalled();

    setVisibility('visible');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stops when it goes away', () => {
    const { unmount } = render(<PollRefresh />);

    unmount();
    act(() => vi.advanceTimersByTime(60_000));

    expect(refresh).not.toHaveBeenCalled();
  });
});
