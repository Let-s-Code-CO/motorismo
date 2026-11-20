import auth from '@web/modules/auth/messages/es.json';
import core from '@web/modules/core/messages/es.json';
import customers from '@web/modules/customers/messages/es.json';
import employees from '@web/modules/employees/messages/es.json';
import pwa from '@web/modules/pwa/messages/es.json';
import services from '@web/modules/services/messages/es.json';
import theme from '@web/modules/theme/messages/es.json';
import users from '@web/modules/users/messages/es.json';
import vehicles from '@web/modules/vehicles/messages/es.json';
import orders from '@web/modules/work-orders/messages/es.json';

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
  ...vehicles,
  ...pwa,
  ...services,
  ...employees,
  ...orders,
  ...theme,
};
