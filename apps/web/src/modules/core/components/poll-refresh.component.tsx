'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

/** How often a customer's screen asks the server again (spec 014, plan). */
const EVERY_MS = 15_000;

/**
 * Keeps a customer's screen up to date without reloading (spec 014, CA-05, CA-22): every 15 s while
 * the tab is visible, and right when the person comes back to it. Not Realtime: a customer may not
 * read the rows it would send, and the queue depends on other customers' orders (plan). A hidden tab
 * asks nothing. `router.refresh()` keeps what is on the client.
 */
const PollRefresh = () => {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(() => router.refresh(), EVERY_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        router.refresh();
        start();
      } else {
        clearInterval(timer);
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  return null;
};

export default PollRefresh;
