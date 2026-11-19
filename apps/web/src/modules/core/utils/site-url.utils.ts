import { env } from '@web/modules/core/config/env.config';

type SiteUrlSources = { siteUrl?: string; vercelUrl?: string };

/**
 * Base URL of this deployment for links in emails and OAuth redirects: explicit site URL first,
 * then the Vercel deployment URL (previews), then local development. No trailing slash.
 */
export const resolveSiteUrl = ({ siteUrl, vercelUrl }: SiteUrlSources): string => {
  const base = siteUrl ?? (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000');
  return base.replace(/\/+$/, '');
};

export const getSiteUrl = () =>
  resolveSiteUrl({ siteUrl: env.NEXT_PUBLIC_SITE_URL, vercelUrl: env.VERCEL_URL });
