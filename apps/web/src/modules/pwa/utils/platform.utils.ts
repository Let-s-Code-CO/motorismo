type DeviceInfo = Pick<Navigator, 'userAgent' | 'maxTouchPoints'> & {
  /** Safari's own flag: the app was opened from the home screen. */
  standalone?: boolean;
};
type MediaInfo = { matchMedia?: (query: string) => { matches: boolean } };

/**
 * An iPhone or iPad, where the browser cannot install the app itself and the steps are shown
 * instead (spec 006, CA-13). An iPad presents itself as a Mac with a touch screen.
 */
export const isIos = (device: DeviceInfo = navigator) =>
  /iPhone|iPad|iPod/.test(device.userAgent) ||
  (/Macintosh/.test(device.userAgent) && device.maxTouchPoints > 1);

/** The app runs installed, opened from its icon: nothing left to install (CA-14). */
export const isStandalone = (device: DeviceInfo = navigator, media: MediaInfo = window) =>
  // Some environments (old engines, tests) have no matchMedia: then only Safari's flag counts.
  media.matchMedia?.('(display-mode: standalone)').matches === true || device.standalone === true;
