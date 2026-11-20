/* eslint-disable @next/next/no-html-link-for-pages -- the bar reacts to any <a>, which is what
   next/link renders; plain links keep these tests about the bar, not about the router. */
/**
 * NavigationProgress — the thin bar under the header while the next screen loads (spec 011, HU-02).
 *
 * Guards:
 * - CA-06: tapping a link to another page of the app starts it; going back or forward too; it
 *   finishes once the new page is shown (the route changed) and then goes away.
 * - CA-07: nothing that does not navigate inside this tab starts it: the same address, another
 *   site, a new tab (`target="_blank"`, Ctrl/⌘/Shift + click, middle click), a download. Its
 *   ~120 ms appearance delay (no flash on instant navigations) is checked in a browser.
 */
import { usePathname, useSearchParams } from 'next/navigation';

import { act, fireEvent, render } from '@testing-library/react';

import NavigationProgress from '@web/modules/core/components/navigation-progress.component';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useSearchParams: vi.fn() }));

const bar = () => document.querySelector('[data-navigation-progress]');

const renderAt = (path: string, links: React.ReactNode) => {
  window.history.replaceState(null, '', path);
  vi.mocked(usePathname).mockReturnValue(path);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
  return render(
    <>
      <NavigationProgress />
      {links}
    </>
  );
};

/** The link click the user does; the test cancels the real navigation (jsdom has none). */
const tap = (element: Element, options: MouseEventInit = {}) => {
  element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  fireEvent.click(element, { button: 0, ...options });
};

describe('NavigationProgress', () => {
  it('starts on a tap on a link to another page and finishes when that page shows (CA-06)', () => {
    const { rerender } = renderAt('/orders', <a href="/customers">Clientes</a>);
    expect(bar()).toBeNull();

    tap(document.querySelector('a')!);
    expect(bar()).toHaveAttribute('data-state', 'loading');

    vi.mocked(usePathname).mockReturnValue('/customers');
    rerender(
      <>
        <NavigationProgress />
        <a href="/customers">Clientes</a>
      </>
    );
    expect(bar()).toHaveAttribute('data-state', 'done');

    // Once it has faded out, it is gone.
    fireEvent.animationEnd(bar()!);
    expect(bar()).toBeNull();
  });

  it('starts when going back or forward, and finishes when that page shows (CA-06)', () => {
    const { rerender } = renderAt('/orders/abc', null);

    // As in a browser: the address has already changed when `popstate` fires; the app still
    // shows the order until the list arrives.
    window.history.replaceState(null, '', '/orders');
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(bar()).toHaveAttribute('data-state', 'loading');

    vi.mocked(usePathname).mockReturnValue('/orders');
    rerender(<NavigationProgress />);
    expect(bar()).toHaveAttribute('data-state', 'done');
  });

  it.each([
    [
      'the same address',
      <a key="a" href="/orders">
        Órdenes
      </a>,
      {},
    ],
    [
      'another site',
      <a key="a" href="https://example.com/x">
        Fuera
      </a>,
      {},
    ],
    [
      'a new tab',
      <a key="a" href="/customers" target="_blank">
        Clientes
      </a>,
      {},
    ],
    [
      'Ctrl + click',
      <a key="a" href="/customers">
        Clientes
      </a>,
      { ctrlKey: true },
    ],
    [
      '⌘ + click',
      <a key="a" href="/customers">
        Clientes
      </a>,
      { metaKey: true },
    ],
    [
      'Shift + click',
      <a key="a" href="/customers">
        Clientes
      </a>,
      { shiftKey: true },
    ],
    [
      'a middle click',
      <a key="a" href="/customers">
        Clientes
      </a>,
      { button: 1 },
    ],
    [
      'a download',
      <a key="a" href="/report.csv" download>
        Descargar
      </a>,
      {},
    ],
  ])('does not start for %s (CA-07)', (_, link, options) => {
    renderAt('/orders', link);

    tap(document.querySelector('a')!, options);

    expect(bar()).toBeNull();
  });

  it('does not start on a click outside any link', () => {
    renderAt('/orders', <button type="button">Algo</button>);

    tap(document.querySelector('button')!);

    expect(bar()).toBeNull();
  });
});
