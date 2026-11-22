/**
 * useBottomBanner — a banner at the bottom of the screen (install, new version: spec 006) makes room
 * for the floating notices (spec 013, CA-02): the notices rise above it instead of covering it.
 *
 * Guards:
 * - While a banner is shown, `--bottom-banners` on the page holds its height plus a gap of 8 px.
 * - With two banners, the tallest counts (they stack at the same place).
 * - When the banner goes away, the room goes too.
 */
import { render } from '@testing-library/react';

import useBottomBanner from '@web/modules/core/hooks/bottom-banner.hook';

const Banner = ({ height }: { height: number }) => {
  const makeRoom = useBottomBanner();
  return (
    <div
      ref={(element) => {
        if (element) Object.defineProperty(element, 'offsetHeight', { value: height });
        return makeRoom(element);
      }}
    />
  );
};

const room = () => document.documentElement.style.getPropertyValue('--bottom-banners');

describe('useBottomBanner', () => {
  it('makes room for a banner: its height plus 8 px (spec 013, CA-02)', () => {
    const { unmount } = render(<Banner height={120} />);

    // 120 + 8 = 128.
    expect(room()).toBe('128px');

    unmount();
    expect(room()).toBe('');
  });

  it('counts the tallest of two banners', () => {
    const { unmount } = render(
      <>
        <Banner height={120} />
        <Banner height={64} />
      </>
    );

    expect(room()).toBe('128px');
    unmount();
  });
});
