'use client';

import { useEffect, useRef, useState } from 'react';

import { usePathname, useSearchParams } from 'next/navigation';

/** Whether a click on this link navigates to another page of the app, in this tab (CA-07). */
const navigatesInApp = (event: MouseEvent) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return false;
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return false;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname + url.search !== window.location.pathname + window.location.search;
};

/**
 * A thin bar at the top edge of the screen while the next screen loads (spec 011, HU-02), so a
 * tap is never in doubt on a slow network. It starts on a tap on a link to another page of the
 * app, or on going back or forward to a page not shown yet (CA-06); it shows after ~120 ms, so an instant navigation shows
 * nothing (CA-07); it finishes once the route changes, fills up and fades out. Still, full width,
 * with «reducir movimiento» (CA-08, CSS). Decorative: the loading screen says «Cargando…».
 *
 * Programmatic navigations (after saving a form) do not start it: their button shows its own
 * loading state. Rendered inside a Suspense boundary (`useSearchParams`).
 */
const NavigationProgress = () => {
  const route = `${usePathname()}?${useSearchParams().toString()}`;
  // The route the navigation started from: while it is still the current one, it is loading.
  const [from, setFrom] = useState<string | null>(null);
  // The route on screen. On «atrás» the browser has already changed the address when `popstate`
  // fires, so the start is taken from what is shown, not from the address bar.
  const shown = useRef(route);
  useEffect(() => {
    shown.current = route;
  }, [route]);

  useEffect(() => {
    const start = () => setFrom(shown.current);
    const onClick = (event: MouseEvent) => {
      if (navigatesInApp(event)) start();
    };
    // A page the router already has is shown within the browser's `popstate`, before this
    // listener: if what is shown is already the new address, there is nothing to wait for.
    const onPopState = () => {
      const address = `${window.location.pathname}?${new URLSearchParams(window.location.search)}`;
      if (shown.current !== address) start();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  if (from === null) return null;
  const loading = from === route;

  return (
    <div
      aria-hidden="true"
      data-navigation-progress
      data-state={loading ? 'loading' : 'done'}
      // Once it has filled up and faded out, it goes away until the next navigation.
      onAnimationEnd={() => {
        if (!loading) setFrom(null);
      }}
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-foreground/70 ${
        loading ? 'animate-progress' : 'animate-progress-done'
      }`}
    />
  );
};

export default NavigationProgress;
