/** Message keys under `auth.errors` in messages/es.json. */
export type AuthErrorKey =
  | 'invalidCredentials'
  | 'accountDisabled'
  | 'googleNotAllowed'
  | 'invalidLink'
  | 'sessionExpired'
  | 'weakPassword'
  | 'rateLimited'
  | 'generic';

const BY_CODE: Record<string, AuthErrorKey> = {
  // RN-06: never reveal whether an email is registered (CA-02).
  invalid_credentials: 'invalidCredentials',
  user_not_found: 'invalidCredentials',
  user_banned: 'accountDisabled',
  account_disabled: 'accountDisabled', // set by the proxy
  signup_disabled: 'googleNotAllowed',
  otp_expired: 'invalidLink',
  flow_state_expired: 'invalidLink',
  flow_state_not_found: 'invalidLink',
  bad_code_verifier: 'invalidLink',
  session_expired: 'sessionExpired', // set by the proxy
  weak_password: 'weakPassword',
  same_password: 'weakPassword',
  over_request_rate_limit: 'rateLimited',
  over_email_send_rate_limit: 'rateLimited',
};

/** Auth error code (or a code set by the proxy) → message key. */
export const mapAuthError = (code?: string | null): AuthErrorKey =>
  (code && BY_CODE[code]) || 'generic';
