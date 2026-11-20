/**
 * UpdateBanner — «Hay una versión nueva» with «Actualizar» (spec 006, HU-04).
 *
 * Guards:
 * - CA-15: with a new version live, the notice shows and offers «Actualizar»; otherwise nothing.
 * - CA-16: «Actualizar» loads the new version on the same page (a reload of the current address).
 * - CA-17 / RN-03: it only reloads when the person asks.
 * - Without network the «Sin conexión» notice speaks alone: updating cannot work then.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import UpdateBanner from '@web/modules/pwa/components/update-banner.component';
import useHasNewVersion from '@web/modules/pwa/hooks/has-new-version.hook';
import { reloadPage } from '@web/modules/pwa/utils/reload.utils';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/pwa/hooks/has-new-version.hook', () => ({ default: vi.fn() }));
vi.mock('@web/modules/pwa/utils/reload.utils', () => ({ reloadPage: vi.fn() }));

describe('UpdateBanner', () => {
  afterEach(() => {
    act(() => void window.dispatchEvent(new Event('online')));
    vi.clearAllMocks();
  });

  it('shows nothing while the open version is the live one', () => {
    vi.mocked(useHasNewVersion).mockReturnValue(false);
    renderWithProviders(<UpdateBanner />);

    expect(screen.queryByText('Hay una versión nueva')).not.toBeInTheDocument();
  });

  it('offers «Actualizar» when a new version is live, and reloads only when pressed (CA-15, CA-16, CA-17)', () => {
    vi.mocked(useHasNewVersion).mockReturnValue(true);
    renderWithProviders(<UpdateBanner />);

    expect(screen.getByText('Hay una versión nueva')).toBeVisible();
    expect(reloadPage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('gives way to «Sin conexión» while there is no network', () => {
    vi.mocked(useHasNewVersion).mockReturnValue(true);
    renderWithProviders(<UpdateBanner />);

    act(() => void window.dispatchEvent(new Event('offline')));

    expect(screen.queryByText('Hay una versión nueva')).not.toBeInTheDocument();
  });
});
