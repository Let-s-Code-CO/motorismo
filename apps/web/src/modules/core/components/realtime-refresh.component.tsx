'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { createSupabaseBrowserClient } from '@web/modules/core/lib/supabase-browser.lib';

/** What the staff screens show: «Órdenes», «Agenda», a reservation, the home's counts. */
const TABLES = ['work_orders', 'reservations', 'agenda_days', 'agenda_weeks', 'agenda_settings'];

/** One order saved touches several rows: refresh once, after the burst. */
const SETTLE_MS = 500;

/**
 * Keeps the staff screens up to date without reloading (spec 012, HU-06, CA-35): when someone opens,
 * starts or closes an order, or books, changes, cancels or attends a reservation, the screen's data
 * come again from the server. Realtime only sends what the person may read (RLS: staff). Coming back
 * to the tab refreshes too. `router.refresh()` keeps what is on the client (typed text, dialogs).
 */
const RealtimeRefresh = () => {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), SETTLE_MS);
    };

    const channel = TABLES.reduce(
      (current, table) =>
        current.on('postgres_changes', { event: '*', schema: 'public', table }, refreshSoon),
      supabase.channel('staff-live')
    ).subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshSoon();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
};

export default RealtimeRefresh;
