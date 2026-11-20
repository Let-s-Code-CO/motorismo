// @vitest-environment node
/**
 * sw.js — the service worker: the only piece that keeps anything on the device (spec 006, HU-02).
 *
 * Its whole job is the "Sin conexión" page: when opening or reloading a page fails for lack of
 * network, it answers with that page instead of the browser's error (CA-09, RF-04), under the
 * same address so «Reintentar» reloads where the person was going (CA-11).
 *
 * Guards RN-02: it keeps only the "Sin conexión" page and one icon, the same for everyone; it
 * never stores the app's pages or anyone's data, and it does not touch any request other than a
 * page navigation and that icon (data, Server Actions, Supabase and the app's scripts go to the
 * network exactly as without it).
 *
 * The file is plain JavaScript served as is; the test runs it in a sandbox with fake `caches`,
 * `fetch` and `clients`, and fires its events by hand.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const SOURCE = readFileSync(join(__dirname, '../../public/sw.js'), 'utf8');
const ORIGIN = 'https://motorismo.test';

type Handler = (event: unknown) => void;

/** A fake Cache Storage: named caches holding responses by path. */
const fakeCaches = (initial: Record<string, string[]> = {}) => {
  const stores = new Map<string, Map<string, Response>>(
    Object.entries(initial).map(([name, paths]) => [
      name,
      new Map(paths.map((path) => [path, new Response(`cached ${path}`)])),
    ])
  );
  const pathOf = (key: string | Request) =>
    new URL(typeof key === 'string' ? key : key.url, ORIGIN).pathname;

  return {
    stores,
    open: vi.fn(async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        addAll: vi.fn(async (paths: string[]) => {
          paths.forEach((path) => store.set(path, new Response(`fetched ${path}`)));
        }),
      };
    }),
    keys: vi.fn(async () => [...stores.keys()]),
    delete: vi.fn(async (name: string) => stores.delete(name)),
    match: vi.fn(async (key: string | Request) => {
      for (const store of stores.values()) {
        const hit = store.get(pathOf(key));
        if (hit) return hit.clone();
      }
      return undefined;
    }),
  };
};

/** Loads sw.js into a fresh sandbox and returns its event handlers and fakes. */
const loadWorker = ({
  caches = fakeCaches(),
  fetch = vi.fn(async () => new Response('from the network')),
} = {}) => {
  const handlers = new Map<string, Handler>();
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  runInNewContext(SOURCE, { self, caches, fetch, URL, Response, Promise });
  return { handlers, self, caches, fetch };
};

/** Fires an install/activate event and waits for what it handed to waitUntil. */
const fireLifecycle = async (handler: Handler) => {
  let pending: Promise<unknown> = Promise.resolve();
  handler({ waitUntil: (promise: Promise<unknown>) => (pending = promise) });
  await pending;
};

/** Fires a fetch event; returns the response it chose, or undefined if it let the request pass. */
const fireFetch = async (
  handler: Handler,
  request: { url: string; mode?: string; method?: string }
) => {
  let response: Promise<Response> | undefined;
  handler({
    request: { method: 'GET', mode: 'cors', ...request, url: `${ORIGIN}${request.url}` },
    respondWith: (promise: Promise<Response>) => (response = promise),
  });
  return response && (await response);
};

describe('sw.js — install and activate', () => {
  it('keeps only the "Sin conexión" page and its icon on install, and takes over at once (RN-02)', async () => {
    const { handlers, caches, self } = loadWorker();

    await fireLifecycle(handlers.get('install')!);

    expect([...caches.stores.keys()]).toEqual(['motorismo-offline-v2']);
    expect([...caches.stores.get('motorismo-offline-v2')!.keys()]).toEqual([
      '/offline',
      '/icons/icon-192.png',
    ]);
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it('deletes the caches of other versions on activate, and controls the open pages', async () => {
    const caches = fakeCaches({ 'motorismo-offline-v1': ['/offline'], 'motorismo-offline-v2': [] });
    const { handlers, self } = loadWorker({ caches });

    await fireLifecycle(handlers.get('activate')!);

    expect([...caches.stores.keys()]).toEqual(['motorismo-offline-v2']);
    expect(self.clients.claim).toHaveBeenCalled();
  });
});

describe('sw.js — fetch', () => {
  const offlineReady = () =>
    fakeCaches({ 'motorismo-offline-v2': ['/offline', '/icons/icon-192.png'] });

  it('serves a page from the network when there is network (nothing is answered from the device)', async () => {
    const { handlers, fetch } = loadWorker({ caches: offlineReady() });

    const response = await fireFetch(handlers.get('fetch')!, {
      url: '/customers',
      mode: 'navigate',
    });

    expect(await response!.text()).toBe('from the network');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('answers a page that cannot be reached with the "Sin conexión" page (CA-09, RF-04)', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { handlers } = loadWorker({ caches: offlineReady(), fetch });

    const response = await fireFetch(handlers.get('fetch')!, {
      url: '/customers',
      mode: 'navigate',
    });

    expect(await response!.text()).toBe('cached /offline');
  });

  it.each([
    ['the data of a page (RSC)', { url: '/customers?_rsc=1' }],
    ['a Server Action', { url: '/customers', method: 'POST' }],
    ["the app's scripts", { url: '/_next/static/chunks/main.js' }],
    ['the version check', { url: '/api/version' }],
  ])('does not touch %s: it goes to the network as without it (RN-02)', async (_, request) => {
    const { handlers, fetch } = loadWorker({ caches: offlineReady() });

    expect(await fireFetch(handlers.get('fetch')!, request)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('serves the icon of the "Sin conexión" page from the device, so it shows without network', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const { handlers } = loadWorker({ caches: offlineReady(), fetch });

    const response = await fireFetch(handlers.get('fetch')!, { url: '/icons/icon-192.png' });

    expect(await response!.text()).toBe('cached /icons/icon-192.png');
  });
});
