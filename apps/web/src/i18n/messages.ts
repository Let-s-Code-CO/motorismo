import auth from '@web/modules/auth/messages/es.json';
import core from '@web/modules/core/messages/es.json';
import users from '@web/modules/users/messages/es.json';

/**
 * The app is Spanish-only. Each module owns `messages/es.json` with a single top-level namespace
 * (its module name); register it here so it reaches the server and client translators.
 */
export const DEFAULT_LOCALE = 'es';

export const messages = {
  ...core,
  ...auth,
  ...users,
};
