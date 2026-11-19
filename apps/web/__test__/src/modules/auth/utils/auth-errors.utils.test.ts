/**
 * mapAuthError — turns Auth error codes into the message a user sees (specs 002 and 004).
 *
 * Guards RN-06: login and recovery never reveal whether an email is registered, so a wrong
 * password and an unknown email produce the SAME message (CA-02).
 */
import { mapAuthError } from '@web/modules/auth/utils/auth-errors.utils';

describe('mapAuthError', () => {
  it('gives the same message for a wrong password and an unknown email (CA-02, RN-06)', () => {
    expect(mapAuthError('invalid_credentials')).toBe('invalidCredentials');
    expect(mapAuthError('user_not_found')).toBe('invalidCredentials');
  });

  it.each(['user_banned', 'account_disabled'])(
    'maps %s to the disabled-account message (CA-06; spec 004, CA-22)',
    (code) => {
      expect(mapAuthError(code)).toBe('accountDisabled');
    }
  );

  it('maps email_not_confirmed to "confirm your email" (spec 004, CA-04)', () => {
    // Auth only reports it with the right password, so it reveals nothing to a stranger (RN-06).
    expect(mapAuthError('email_not_confirmed')).toBe('emailNotConfirmed');
  });

  it.each(['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier'])(
    'maps %s to the invalid-link message (CA-15, CA-24)',
    (code) => {
      expect(mapAuthError(code)).toBe('invalidLink');
    }
  );

  it('maps session_expired to the inactivity message', () => {
    expect(mapAuthError('session_expired')).toBe('sessionExpired');
  });

  it.each(['weak_password', 'same_password'])('maps %s to the password rule message', (code) => {
    expect(mapAuthError(code)).toBe('weakPassword');
  });

  it.each(['over_request_rate_limit', 'over_email_send_rate_limit'])(
    'maps %s to the "too many attempts" message (brute-force protection)',
    (code) => {
      expect(mapAuthError(code)).toBe('rateLimited');
    }
  );

  it.each([undefined, null, '', 'something_new'])(
    'falls back to a generic message for %s',
    (code) => {
      expect(mapAuthError(code)).toBe('generic');
    }
  );
});
