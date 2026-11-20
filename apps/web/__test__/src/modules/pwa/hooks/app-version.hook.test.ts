/**
 * useNewVersion — whether a newer version of the app is live than the one open (spec 006, HU-04).
 *
 * A tablet may keep the app open all day; this tells it when a new version was published, so it
 * can offer «Actualizar» (CA-15) without ever reloading by itself (CA-17, RN-03).
 *
 * Guards:
 * - it asks /api/version when the person comes back to the app's window and every 5 minutes while
 *   it is open (CA-15);
 * - only a different version counts as new; the same one, an error or no answer do not;
 * - without network it asks nothing (the «Sin conexión» notice is what matters then);
 * - it never reloads the page: 30 minutes after finding a new version, nothing has reloaded.
 */
import { act, renderHook } from '@testing-library/react';

import useNewVersion from '@web/modules/pwa/hooks/app-version.hook';
import { reloadPage } from '@web/modules/pwa/utils/reload.utils';

vi.mock('@web/modules/pwa/utils/reload.utils', () => ({ reloadPage: vi.fn() }));

const BUILD = 'build-1';
const live = (version: string) => new Response(JSON.stringify({ version }), { status: 200 });

const comeBackToWindow = () =>
  act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });

describe('useNewVersion', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    act(() => void window.dispatchEvent(new Event('online')));
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('finds a new version when the person comes back to the window (CA-15)', async () => {
    fetchMock.mockResolvedValue(live('build-2'));
    const { result } = renderHook(() => useNewVersion(BUILD));
    expect(result.current).toBe(false);

    await comeBackToWindow();

    expect(fetchMock).toHaveBeenCalledWith('/api/version', { cache: 'no-store' });
    expect(result.current).toBe(true);
  });

  it('asks every 5 minutes while the app is open (CA-15)', async () => {
    fetchMock.mockResolvedValue(live(BUILD));
    renderHook(() => useNewVersion(BUILD));

    await act(() => vi.advanceTimersByTimeAsync(15 * 60_000));

    // 15 min / 5 min = 3 checks.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['the same version is live', () => Promise.resolve(live(BUILD))],
    ['the server answers an error', () => Promise.resolve(new Response('', { status: 500 }))],
    ['the request fails', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('finds nothing new when %s', async (_, answer) => {
    fetchMock.mockImplementation(answer);
    const { result } = renderHook(() => useNewVersion(BUILD));

    await comeBackToWindow();

    expect(result.current).toBe(false);
  });

  it('asks nothing without network', async () => {
    const { result } = renderHook(() => useNewVersion(BUILD));
    act(() => void window.dispatchEvent(new Event('offline')));

    await comeBackToWindow();
    await act(() => vi.advanceTimersByTimeAsync(4_000));

    // Only the "is the network back?" probe may run meanwhile, never the version check.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });

  it('never reloads by itself, even 30 minutes after finding a new version (CA-17, RN-03)', async () => {
    fetchMock.mockResolvedValue(live('build-2'));
    const { result } = renderHook(() => useNewVersion(BUILD));

    await comeBackToWindow();
    await act(() => vi.advanceTimersByTimeAsync(30 * 60_000));

    expect(result.current).toBe(true);
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
