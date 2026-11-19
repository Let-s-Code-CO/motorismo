import auth from '@web/modules/auth/messages/es.json';
import core from '@web/modules/core/messages/es.json';
import customers from '@web/modules/customers/messages/es.json';
import users from '@web/modules/users/messages/es.json';

/**
 * The app is Spanish-only. Each module owns `messages/es.json` with a single top-level namespace
 * (its module name); register it here so it reaches the server and client translators.
 */
export const DEFAULT_LOCALE = 'es';

/** Dates are shown in Colombian time (the business is in Bogotá). */
export const TIME_ZONE = 'America/Bogota';

export const messages = {
  ...core,
  ...auth,
  ...users,
  ...customers,
};
