'use client';

import { useEffect, useRef, useTransition } from 'react';

import { useRouter } from 'next/navigation';

type UrlFiltersOptions<F> = {
  /** The filters the page shows: those of its address, as the server rendered them. */
  filters: F;
  /** The address of some filters. Two filters with the same address are the same. */
  href: (filters: F) => string;
  /**
   * The address changed from outside («atrás», a link): the screen updates what it keeps of its
   * own, such as a search box.
   */
  onOutside: (filters: F) => void;
};

/**
 * Filters that live in the address (project standard): each change replaces it and the server
 * renders the screen again. Several changes can be on their way at once (a card pressed while a
 * search waits its 300 ms, a search typed slowly on a slow network), so each one builds on the
 * newest asked for (`latest`), not on what the page still shows, and none undoes another. An
 * answer of ours arriving late is not taken for a change from outside. Used by «Clientes» (spec
 * 004) and the services report (spec 015).
 */
const useUrlFilters = <F>({ filters, href, onOutside }: UrlFiltersOptions<F>) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Asked for and not shown yet, oldest first.
  const requested = useRef<F[]>([]);
  // What the page shows, read when a delayed search fires (its timer was set on an older render).
  const showing = useRef(filters);

  const latest = () => requested.current.at(-1) ?? showing.current;

  const navigate = (next: F) => {
    requested.current.push(next);
    startTransition(() => router.replace(href(next), { scroll: false }));
  };

  const shown = href(filters);
  useEffect(() => {
    showing.current = filters;
    const index = requested.current.findIndex((asked) => href(asked) === shown);
    // One of ours arrived: those before it are past, and a newer one still on its way wins.
    if (index >= 0) {
      requested.current = requested.current.slice(index + 1);
      return;
    }
    requested.current = [];
    onOutside(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shown` is the whole of `filters`
  }, [shown]);

  return { navigate, latest, isPending };
};

export default useUrlFilters;
