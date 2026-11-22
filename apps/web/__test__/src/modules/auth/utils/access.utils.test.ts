/**
 * access.utils — the routing decision the proxy takes on EVERY request (specs 002 and 004).
 *
 * Guards:
 * - CA-03: without a session, internal pages lead to the login, remembering the requested page.
 * - CA-05: with an active session, the login page leads to the home page.
 * - CA-06 / CA-19: a disabled (or profile-less) account is signed out and sent to the login with
 *   the "account disabled" message, on its very next request.
 * - An invited user who opened their invitation link must create a password before anything else;
 *   an invited session that did NOT come from an email link (e.g. a password sign-in) is signed
 *   out (spec 004, plan risk 2: only the link proves the invitation is theirs).
 * - Spec 004: customers land on their own home (CA-12; spec 014 makes it «Inicio», `/my`); staff pages are not hidden by the proxy but
 *   answered by the page with "no permission" (CA-09); a disabled customer is signed out (CA-29);
 *   /auth/sign-up is for visitors and /privacy is public for everyone (RF-03).
 * - Spec assumption: a session unused for more than 7 days is closed.
 * - sanitizeNextPath blocks open redirects: only internal, non-auth paths are honoured.
 */
import {
  SESSION_INACTIVITY_LIMIT_MS,
  decideAccess,
  destinationAfterSignIn,
  isSessionExpired,
  sanitizeNextPath,
} from '@web/modules/auth/utils/access.utils';

const NOW = Date.UTC(2026, 10, 19, 12, 0, 0);
const ONE_HOUR = 60 * 60 * 1000;

type Input = Parameters<typeof decideAccess>[0];

const build = (overrides: Partial<Input> = {}): Input => ({
  pathname: '/',
  search: '',
  hasSession: true,
  account: { kind: 'staff', status: 'active' },
  authMethods: ['password'],
  lastSeenAt: NOW - ONE_HOUR,
  now: NOW,
  ...overrides,
});

describe('decideAccess', () => {
  describe('without a session', () => {
    const anonymous = { hasSession: false, account: null, authMethods: [], lastSeenAt: null };

    it('sends internal pages to the login and remembers the requested page (CA-03)', () => {
      expect(
        decideAccess(build({ ...anonymous, pathname: '/admin/users', search: '?page=2' }))
      ).toEqual({
        type: 'redirect',
        to: '/auth/login?next=%2Fadmin%2Fusers%3Fpage%3D2',
        signOut: false,
      });
    });

    it('sends the home page to the login without a next parameter', () => {
      expect(decideAccess(build({ ...anonymous, pathname: '/' }))).toEqual({
        type: 'redirect',
        to: '/auth/login',
        signOut: false,
      });
    });

    it.each(['/auth/login', '/auth/forgot-password', '/auth/sign-up'])(
      'lets visitors open %s',
      (pathname) => {
        expect(decideAccess(build({ ...anonymous, pathname }))).toEqual({
          type: 'allow',
          touchActivity: false,
        });
      }
    );

    it.each(['/auth/confirm', '/auth/callback', '/auth/invalid-link'])(
      'lets anyone reach the link-handling route %s',
      (pathname) => {
        expect(decideAccess(build({ ...anonymous, pathname }))).toEqual({
          type: 'allow',
          touchActivity: false,
        });
      }
    );

    it('sends /auth/set-password to the login: it needs the session created by an email link', () => {
      expect(decideAccess(build({ ...anonymous, pathname: '/auth/set-password' }))).toEqual({
        type: 'redirect',
        to: '/auth/login',
        signOut: false,
      });
    });
  });

  describe('with an active session', () => {
    it('allows internal pages and refreshes the activity timestamp', () => {
      expect(decideAccess(build({ pathname: '/admin/users' }))).toEqual({
        type: 'allow',
        touchActivity: true,
      });
    });

    it.each(['/auth/login', '/auth/forgot-password', '/auth/sign-up'])(
      'sends %s to the home page (CA-05)',
      (pathname) => {
        expect(decideAccess(build({ pathname }))).toEqual({
          type: 'redirect',
          to: '/',
          signOut: false,
        });
      }
    );

    it('allows /auth/set-password (password recovery happens with an active account)', () => {
      expect(decideAccess(build({ pathname: '/auth/set-password' }))).toEqual({
        type: 'allow',
        touchActivity: true,
      });
    });

    it('closes a session unused for more than 7 days', () => {
      expect(decideAccess(build({ lastSeenAt: NOW - SESSION_INACTIVITY_LIMIT_MS - 1 }))).toEqual({
        type: 'redirect',
        to: '/auth/login?error=session_expired',
        signOut: true,
      });
    });
  });

  describe('with a session whose account cannot be used', () => {
    it('signs a disabled user out on their next request, with the disabled message (CA-06, CA-19)', () => {
      expect(decideAccess(build({ account: { kind: 'staff', status: 'disabled' } }))).toEqual({
        type: 'redirect',
        to: '/auth/login?error=account_disabled',
        signOut: true,
      });
    });

    it('signs out a session with neither a staff profile nor a customer record (it can never be authorized)', () => {
      expect(decideAccess(build({ account: null }))).toEqual({
        type: 'redirect',
        to: '/auth/login?error=account_disabled',
        signOut: true,
      });
    });

    it('checks the disabled status before inactivity, so the user sees why they were removed', () => {
      expect(
        decideAccess(build({ account: { kind: 'staff', status: 'disabled' }, lastSeenAt: null }))
      ).toMatchObject({ to: '/auth/login?error=account_disabled' });
    });
  });

  describe('with an invited user (session created by the invitation link)', () => {
    // Every email link (invitation, recovery, confirmation) opens a session with the "otp" method.
    const invited = {
      account: { kind: 'staff' as const, status: 'invited' as const },
      authMethods: ['otp'],
    };

    it('sends every page to /auth/set-password until a password exists', () => {
      expect(decideAccess(build({ ...invited, pathname: '/' }))).toEqual({
        type: 'redirect',
        to: '/auth/set-password',
        signOut: false,
      });
    });

    it('allows /auth/set-password itself', () => {
      expect(decideAccess(build({ ...invited, pathname: '/auth/set-password' }))).toEqual({
        type: 'allow',
        touchActivity: true,
      });
    });
  });

  describe('with an invited user whose session did not come from an email link', () => {
    it('signs them out: only the invitation link proves the invitation is theirs (plan risk 2)', () => {
      expect(
        decideAccess(
          build({
            account: { kind: 'staff', status: 'invited' },
            authMethods: ['password'],
            pathname: '/auth/set-password',
          })
        )
      ).toEqual({ type: 'redirect', to: '/auth/login', signOut: true });
    });
  });

  describe('with a customer session (spec 004)', () => {
    const customer = { account: { kind: 'customer' as const, status: 'active' as const } };

    it('sends the home page to their own home, «Inicio» (CA-12; spec 014, RF-01)', () => {
      expect(decideAccess(build({ ...customer, pathname: '/' }))).toEqual({
        type: 'redirect',
        to: '/my',
        signOut: false,
      });
    });

    it.each(['/auth/login', '/auth/forgot-password', '/auth/sign-up'])(
      'sends %s to their own home (spec 014)',
      (pathname) => {
        expect(decideAccess(build({ ...customer, pathname }))).toEqual({
          type: 'redirect',
          to: '/my',
          signOut: false,
        });
      }
    );

    it('allows their profile and refreshes the activity timestamp', () => {
      expect(decideAccess(build({ ...customer, pathname: '/profile' }))).toEqual({
        type: 'allow',
        touchActivity: true,
      });
    });

    it('lets a staff page through so the page answers "no permission" with a link to the profile (CA-09)', () => {
      expect(decideAccess(build({ ...customer, pathname: '/customers' }))).toEqual({
        type: 'allow',
        touchActivity: true,
      });
    });

    it('allows /auth/set-password (a customer recovering their password)', () => {
      expect(decideAccess(build({ ...customer, pathname: '/auth/set-password' }))).toEqual({
        type: 'allow',
        touchActivity: true,
      });
    });

    it('signs a disabled customer out on their next request, with the disabled message (CA-29)', () => {
      expect(
        decideAccess(
          build({ account: { kind: 'customer', status: 'disabled' }, pathname: '/profile' })
        )
      ).toEqual({ type: 'redirect', to: '/auth/login?error=account_disabled', signOut: true });
    });
  });

  describe('the privacy policy (RF-03)', () => {
    it.each([
      ['a visitor', { hasSession: false, account: null, lastSeenAt: null }],
      ['a staff member', {}],
      ['a customer', { account: { kind: 'customer' as const, status: 'active' as const } }],
    ])('is open to %s', (_who, overrides) => {
      expect(decideAccess(build({ ...overrides, pathname: '/privacy' }))).toEqual({
        type: 'allow',
        touchActivity: false,
      });
    });
  });
});

describe('isSessionExpired', () => {
  it('is false within 7 days of the last activity', () => {
    expect(isSessionExpired(NOW - SESSION_INACTIVITY_LIMIT_MS, NOW)).toBe(false);
  });

  it('is true after more than 7 days without activity', () => {
    // 7 days = 7 × 24 × 60 × 60 × 1000 = 604_800_000 ms
    expect(SESSION_INACTIVITY_LIMIT_MS).toBe(604_800_000);
    expect(isSessionExpired(NOW - SESSION_INACTIVITY_LIMIT_MS - 1, NOW)).toBe(true);
  });

  it('is true when there is no activity record (cookie expired after 7 days or was removed)', () => {
    expect(isSessionExpired(null, NOW)).toBe(true);
  });
});

describe('sanitizeNextPath', () => {
  it.each([
    ['/admin/users', '/admin/users'],
    ['/admin/users?page=2', '/admin/users?page=2'],
  ])('keeps the internal path %s', (raw, expected) => {
    expect(sanitizeNextPath(raw)).toBe(expected);
  });

  it.each([
    ['an absolute URL to another site', 'https://evil.example.com/'],
    ['a protocol-relative URL', '//evil.example.com'],
    ['a backslash trick', '/\\evil.example.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path without leading slash', 'admin'],
    ['an auth page (would loop back to the login)', '/auth/login'],
    ['an empty value', ''],
    ['a missing value', null],
  ])('rejects %s', (_case, raw) => {
    expect(sanitizeNextPath(raw)).toBeNull();
  });
});

describe('destinationAfterSignIn (spec 004, RF-02)', () => {
  it.each([
    ['staff', '/admin/users', '/admin/users'],
    ['staff', null, '/'],
    ['customer', '/profile', '/profile'],
    ['customer', '/privacy', '/privacy'],
    // Spec 014: their area.
    ['customer', '/my', '/my'],
    ['customer', '/my/history', '/my/history'],
    ['customer', '/my/reservations/new', '/my/reservations/new'],
    ['customer', null, '/my'],
  ] as const)('a %s asking for %s goes to %s', (kind, next, expected) => {
    expect(destinationAfterSignIn(kind, next)).toBe(expected);
  });

  it.each(['/customers', '/admin/users', '/', '/profiles-of-others', '/myself'])(
    'a customer who asked for %s (not theirs) goes to their own home instead',
    (next) => {
      expect(destinationAfterSignIn('customer', next)).toBe('/my');
    }
  );

  it('an unknown account goes to the requested page or home (the proxy decides next)', () => {
    expect(destinationAfterSignIn(null, '/customers')).toBe('/customers');
  });
});
