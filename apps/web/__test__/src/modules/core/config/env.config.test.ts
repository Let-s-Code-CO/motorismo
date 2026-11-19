// @vitest-environment node
/**
 * env.config — validated environment for the Supabase connection (spec 001 CA-05, spec 002).
 *
 * Business rule: a deployment without valid Supabase settings must fail at boot, with a clear
 * error, instead of rendering pages that break on the first query. Runs in a Node environment
 * because server-only variables (the secret key) are only validated on the server.
 * The module validates on import, so each case stubs the env and re-imports it fresh.
 */
// Wrapped in an object: resolving a promise with the env proxy itself would read `env.then`, which
// t3-env rejects as an unknown variable.
const importEnv = async () => {
  vi.resetModules();
  const { env } = await import('@web/modules/core/config/env.config');
  return { env };
};

const VALID = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
  NEXT_PUBLIC_SITE_URL: 'https://motorismo.example.com',
};

const stubEnv = (overrides: Partial<Record<keyof typeof VALID, string>> = {}) => {
  Object.entries({ ...VALID, ...overrides }).forEach(([key, value]) => vi.stubEnv(key, value));
};

describe('env.config', () => {
  beforeEach(() => {
    vi.stubEnv('SKIP_ENV_VALIDATION', '');
    // t3-env reports the invalid fields with console.error before throwing.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('exposes the Supabase URL, publishable key, secret key and site URL when all are valid', async () => {
    stubEnv();

    const { env } = await importEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_test');
    expect(env.SUPABASE_SECRET_KEY).toBe('sb_secret_test');
    expect(env.NEXT_PUBLIC_SITE_URL).toBe('https://motorismo.example.com');
  });

  it('fails on import when the publishable key is missing (empty counts as missing)', async () => {
    stubEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' });

    await expect(importEnv()).rejects.toThrow('Invalid environment variables');
  });

  it('fails on import when the Supabase URL is not a URL', async () => {
    stubEnv({ NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' });

    await expect(importEnv()).rejects.toThrow('Invalid environment variables');
  });

  it('fails on import on the server when the secret key is missing (needed to invite users)', async () => {
    stubEnv({ SUPABASE_SECRET_KEY: '' });

    await expect(importEnv()).rejects.toThrow('Invalid environment variables');
  });

  it('accepts a missing site URL because it falls back to the Vercel URL or localhost', async () => {
    stubEnv({ NEXT_PUBLIC_SITE_URL: '' });

    const { env } = await importEnv();

    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });
});
