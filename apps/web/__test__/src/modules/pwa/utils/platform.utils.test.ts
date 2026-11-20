/**
 * platform.utils — which device and mode the app runs in, to offer «Instalar app» (spec 006, HU-03).
 *
 * Guards:
 * - CA-13: on an iPhone or iPad the browser cannot install the app itself, so the steps to add it
 *   to the home screen are shown instead. An iPad presents itself as a Mac with a touch screen:
 *   that counts as an iPad; a desktop Mac (no touch) and Android do not.
 * - CA-14: once installed and opened from its icon (standalone, or Safari's home-screen mode),
 *   there is nothing left to install.
 */
import { isIos, isStandalone } from '@web/modules/pwa/utils/platform.utils';

const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  android:
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

const device = ({
  userAgent = UA.android,
  maxTouchPoints = 0,
  standalone = undefined as boolean | undefined,
} = {}) => ({
  userAgent,
  maxTouchPoints,
  standalone,
});

const media = (standalone: boolean) => ({ matchMedia: () => ({ matches: standalone }) });

describe('isIos', () => {
  it.each([
    ['an iPhone', device({ userAgent: UA.iphone, maxTouchPoints: 5 }), true],
    [
      'an iPad that presents itself as a Mac with a touch screen',
      device({ userAgent: UA.ipadAsMac, maxTouchPoints: 5 }),
      true,
    ],
    [
      'a desktop Mac (no touch screen)',
      device({ userAgent: UA.ipadAsMac, maxTouchPoints: 0 }),
      false,
    ],
    ['an Android phone', device({ userAgent: UA.android, maxTouchPoints: 5 }), false],
  ])('on %s is %s (CA-13)', (_, nav, expected) => {
    expect(isIos(nav)).toBe(expected);
  });
});

describe('isStandalone', () => {
  it('is true when the app was opened from its icon, in its own window (CA-14)', () => {
    expect(isStandalone(device(), media(true))).toBe(true);
  });

  it("is true in Safari's home-screen mode, which does not report the display mode (CA-14)", () => {
    expect(isStandalone(device({ userAgent: UA.iphone, standalone: true }), media(false))).toBe(
      true
    );
  });

  it('is false in a browser tab', () => {
    expect(isStandalone(device({ standalone: false }), media(false))).toBe(false);
  });
});
