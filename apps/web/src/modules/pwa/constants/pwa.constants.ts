/** Answers the app's version; also the probe that tells whether the network is back (spec 006). */
export const VERSION_URL = '/api/version';

/** While offline, how often the app checks whether the network is back (CA-08). */
export const CONNECTION_PROBE_MS = 5_000;

/** While the app is open, how often it checks for a new version (CA-15). */
export const VERSION_CHECK_MS = 5 * 60_000;

/** The service worker: the only piece that keeps something on the device (RN-02). */
export const SERVICE_WORKER_URL = '/sw.js';
