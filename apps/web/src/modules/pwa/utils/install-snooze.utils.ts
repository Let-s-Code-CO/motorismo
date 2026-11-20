/** Where the device remembers the last «Ahora no» of the install notice (spec 006, CA-19). */
const KEY = 'motorismo.install-snoozed-at';

/** How long «Ahora no» hides the install notice on a device (CA-19). */
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60_000;

/**
 * Whether «Ahora no» was pressed on this device less than 14 days ago. Only a date is kept, which
 * is nobody's data (RN-02). If the browser blocks storage, the notice just shows again.
 */
export const isInstallSnoozed = (now = Date.now()) => {
  try {
    const snoozedAt = Number(localStorage.getItem(KEY));
    return snoozedAt > 0 && now - snoozedAt < INSTALL_SNOOZE_MS;
  } catch {
    return false;
  }
};

export const snoozeInstall = (now = Date.now()) => {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked: hidden for this visit only.
  }
};
