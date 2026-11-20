/**
 * InstallBanner — the floating «Instala Motorismo en este dispositivo» notice (spec 006, HU-03).
 *
 * Guards:
 * - CA-18: where the app can be installed, a signed-in person sees the notice at the bottom;
 *   «Instalar» asks the browser to install (as in CA-12) or, on an iPhone or iPad, shows the steps
 *   (as in CA-13).
 * - CA-19: «Ahora no» hides it, and it does not come back on that device for 14 days.
 * - CA-14: not shown once installed, or where the app cannot be installed.
 * - CA-20: «Sin conexión» and «Hay una versión nueva» are more urgent: meanwhile it waits.
 * - A browser that blocks local storage still works: the notice simply shows again next time.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import useHasNewVersion from '@web/modules/pwa/hooks/has-new-version.hook';
import useInstallPrompt from '@web/modules/pwa/hooks/install-prompt.hook';
import { promptInstall } from '@web/modules/pwa/utils/install-prompt.lib';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/pwa/hooks/install-prompt.hook', () => ({ default: vi.fn() }));
vi.mock('@web/modules/pwa/hooks/has-new-version.hook', () => ({ default: vi.fn() }));
vi.mock('@web/modules/pwa/utils/install-prompt.lib', () => ({ promptInstall: vi.fn() }));

const TITLE = 'Instala Motorismo en este dispositivo';
const NOW = new Date('2026-11-20T15:00:00Z');
const DAY = 24 * 60 * 60_000;

const renderBanner = async () => {
  const { default: InstallBanner } =
    await import('@web/modules/pwa/components/install-banner.component');
  return renderWithProviders(<InstallBanner />);
};

describe('InstallBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    vi.mocked(useInstallPrompt).mockReturnValue('prompt');
    vi.mocked(useHasNewVersion).mockReturnValue(false);
  });

  afterEach(() => {
    act(() => void window.dispatchEvent(new Event('online')));
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('tells a person the app can be installed, and «Instalar» asks the browser (CA-18)', async () => {
    await renderBanner();

    expect(screen.getByText(TITLE)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    expect(promptInstall).toHaveBeenCalledTimes(1);
  });

  it('on an iPhone, «Instalar» shows the steps to add it to the home screen (CA-18, CA-13)', async () => {
    vi.mocked(useInstallPrompt).mockReturnValue('ios');
    await renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));

    // The dialog is still fading in (opacity), so the test reads its content, not its visibility.
    expect(
      await screen.findByRole('dialog', { name: 'Instalar Motorismo en tu iPhone o iPad' })
    ).toHaveTextContent('Elige «Agregar a inicio».');
    expect(promptInstall).not.toHaveBeenCalled();
  });

  it('«Ahora no» hides it, and it stays hidden on that device for 14 days (CA-19)', async () => {
    const { unmount } = await renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    unmount();

    // 13 days later, it is still hidden.
    vi.setSystemTime(NOW.getTime() + 13 * DAY);
    const later = await renderBanner();
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    later.unmount();

    // 14 days later, it shows again.
    vi.setSystemTime(NOW.getTime() + 14 * DAY);
    await renderBanner();
    expect(screen.getByText(TITLE)).toBeVisible();
  });

  it('shows nothing once installed or where the app cannot be installed (CA-14)', async () => {
    vi.mocked(useInstallPrompt).mockReturnValue(null);
    await renderBanner();

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('waits while «Hay una versión nueva» is showing (CA-20)', async () => {
    vi.mocked(useHasNewVersion).mockReturnValue(true);
    await renderBanner();

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('waits while there is no network (CA-20)', async () => {
    await renderBanner();

    act(() => void window.dispatchEvent(new Event('offline')));

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('still works when the browser blocks local storage: it simply shows again next time', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    await renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });
});
