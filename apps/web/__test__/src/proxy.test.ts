// @vitest-environment node
/**
 * proxy — which requests go through the access check on every request (spec 002, RF-01).
 *
 * Spec 006 leaves a few exact paths out, because they need no session and must answer anyone:
 * the manifest (browsers fetch it without cookies; a visitor would get a redirect to the login
 * instead), the service worker, its "Sin conexión" page and /api/version (polled every few seconds
 * while offline). Guards that exactly those paths are left out, and nothing that merely starts
 * like them: a future /offline-report or /api/version-history still goes through the check.
 */
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

import { config } from '@web/proxy';

const checked = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe('proxy matcher', () => {
  it.each(['/', '/customers', '/admin/users', '/auth/login', '/privacy'])(
    'checks access on %s',
    (url) => {
      expect(checked(url)).toBe(true);
    }
  );

  it.each(['/manifest.webmanifest', '/sw.js', '/offline', '/api/version'])(
    'leaves out %s, which must answer without a session (spec 006)',
    (url) => {
      expect(checked(url)).toBe(false);
    }
  );

  it.each(['/offline-report', '/offlineusers', '/api/version-history', '/sw.jsx'])(
    'still checks %s, which only starts like a path left out',
    (url) => {
      expect(checked(url)).toBe(true);
    }
  );
});
