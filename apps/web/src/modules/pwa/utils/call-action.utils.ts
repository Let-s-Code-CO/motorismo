import { markOffline } from '@web/modules/pwa/utils/connection.lib';

/** How each browser words a request that never reached the server (Chrome, Safari, Firefox). */
const NETWORK_FAILURE = /failed to fetch|load failed|networkerror|network request failed/i;

export const isNetworkError = (error: unknown) =>
  error instanceof TypeError && NETWORK_FAILURE.test(error.message);

/**
 * Calls a Server Action from a screen (spec 006, CA-10). If the request never reaches the server,
 * the app turns offline (the «Sin conexión» notice shows) and this returns null, which the screen
 * reads as "nothing happened": no success, no error of its own, and the form stays as it was.
 * Nothing is queued to send later (RN-01). Any other error is thrown as usual.
 */
export const callAction = async <T>(action: () => Promise<T>): Promise<T | null> => {
  try {
    return await action();
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    markOffline();
    return null;
  }
};
