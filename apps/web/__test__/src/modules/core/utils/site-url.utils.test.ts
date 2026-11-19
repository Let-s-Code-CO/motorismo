/**
 * resolveSiteUrl — the base URL used in invitation, recovery and Google redirect links (spec 002).
 *
 * Links in emails must point back to the deployment that sent them: an explicit site URL wins,
 * then the Vercel deployment URL (previews), then local development.
 */
import { resolveSiteUrl } from '@web/modules/core/utils/site-url.utils';

describe('resolveSiteUrl', () => {
  it('uses the explicit site URL first, without a trailing slash', () => {
    expect(
      resolveSiteUrl({ siteUrl: 'https://app.motorismo.co/', vercelUrl: 'preview.vercel.app' })
    ).toBe('https://app.motorismo.co');
  });

  it('falls back to the Vercel deployment URL over https (preview deployments)', () => {
    expect(resolveSiteUrl({ vercelUrl: 'motorismo-git-x.vercel.app' })).toBe(
      'https://motorismo-git-x.vercel.app'
    );
  });

  it('falls back to localhost:3000 in local development', () => {
    expect(resolveSiteUrl({})).toBe('http://localhost:3000');
  });
});
