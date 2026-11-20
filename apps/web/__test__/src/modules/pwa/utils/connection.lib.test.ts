/**
 * connection.lib — whether the app has network right now (spec 006, HU-02, RF-03).
 *
 * The whole app reads this one value: offline, the "Sin conexión" notice shows and nothing can be
 * done (CA-06, CA-07); back online, everything works again (CA-08).
 *
 * Guards:
 * - it goes offline when the device says so (the `offline` event, or `navigator.onLine` false when
 *   the app starts) and when a submission fails for lack of network (`markOffline`, CA-10): a
 *   Wi-Fi connected without internet is only found out that way;
 * - it comes back online with the `online` event, or when the probe (a request to /api/version
 *   every 5 s, only while offline) gets an answer;
 * - with network there is no probe: nothing polls the server in the normal case.
 */
type ConnectionModule = typeof import('@web/modules/pwa/utils/connection.lib');

/** A fresh copy of the module: its state lives at module level. */
const load = async (): Promise<ConnectionModule> => {
  vi.resetModules();
  return import('@web/modules/pwa/utils/connection.lib');
};

const setDeviceOnline = (online: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online });

describe('connection.lib', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    setDeviceOnline(true);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts online when the device has network, and polls nothing', async () => {
    const { subscribeConnection, getConnectionSnapshot } = await load();
    subscribeConnection(() => {});

    await vi.advanceTimersByTimeAsync(60_000);

    expect(getConnectionSnapshot()).toBe('online');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts offline when the device has no network as the app opens (CA-06)', async () => {
    setDeviceOnline(false);
    const { subscribeConnection, getConnectionSnapshot } = await load();

    subscribeConnection(() => {});

    expect(getConnectionSnapshot()).toBe('offline');
  });

  it('goes offline with the device and back online with it, telling its subscribers (CA-06, CA-08)', async () => {
    const { subscribeConnection, getConnectionSnapshot } = await load();
    const listener = vi.fn();
    subscribeConnection(listener);

    window.dispatchEvent(new Event('offline'));
    expect(getConnectionSnapshot()).toBe('offline');

    window.dispatchEvent(new Event('online'));
    expect(getConnectionSnapshot()).toBe('online');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('goes offline when a submission failed for lack of network, even if the device says it is online (CA-10)', async () => {
    const { subscribeConnection, getConnectionSnapshot, markOffline } = await load();
    subscribeConnection(() => {});

    markOffline();

    expect(getConnectionSnapshot()).toBe('offline');
  });

  it('while offline, probes /api/version every 5 s and comes back online when it answers (CA-08)', async () => {
    const { subscribeConnection, getConnectionSnapshot, markOffline } = await load();
    subscribeConnection(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

    markOffline();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(getConnectionSnapshot()).toBe('offline');

    await vi.advanceTimersByTimeAsync(5_000);
    expect(getConnectionSnapshot()).toBe('online');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith('/api/version', { cache: 'no-store' });

    // Back online, the probe stops: 1 minute later there were still only those 2 requests.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops telling a listener once it unsubscribes', async () => {
    const { subscribeConnection } = await load();
    const listener = vi.fn();
    const unsubscribe = subscribeConnection(listener);

    unsubscribe();
    window.dispatchEvent(new Event('offline'));

    expect(listener).not.toHaveBeenCalled();
  });
});
