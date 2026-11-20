import { CONNECTION_PROBE_MS, VERSION_URL } from '@web/modules/pwa/constants/pwa.constants';

/** Whether the app can reach the server right now (spec 006, RF-03). */
export type ConnectionState = 'online' | 'offline';

let state: ConnectionState = 'online';
let started = false;
let probe: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

const set = (next: ConnectionState) => {
  if (state === next) return;
  state = next;
  if (next === 'offline' && !probe) probe = setInterval(checkServer, CONNECTION_PROBE_MS);
  if (next === 'online' && probe) {
    clearInterval(probe);
    probe = undefined;
  }
  listeners.forEach((listener) => listener());
};

/** While offline: any answer from the server means the network is back (CA-08). */
const checkServer = async () => {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (response.ok) set('online');
  } catch {
    // Still no network: try again on the next tick.
  }
};

/** Listens to the device once, on the first subscriber (never on the server). */
const start = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('offline', () => set('offline'));
  window.addEventListener('online', () => set('online'));
  if (!navigator.onLine) set('offline');
};

/**
 * A submission failed for lack of network (CA-10). The device may still say it is online (a
 * Wi-Fi without internet): the probe brings the app back when the server answers again.
 */
export const markOffline = () => set('offline');

export const subscribeConnection = (listener: () => void) => {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getConnectionSnapshot = (): ConnectionState => state;

/** The server renders as online: the client corrects it on hydration. */
export const getServerConnectionSnapshot = (): ConnectionState => 'online';
