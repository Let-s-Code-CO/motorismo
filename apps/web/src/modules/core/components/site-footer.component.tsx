import { useTranslations } from 'next-intl';

import InstagramIcon from '@web/modules/core/components/instagram-icon.component';

export const INSTAGRAM_URL = 'https://www.instagram.com/motorismodetail/';

type SiteFooterProps = {
  /** "dark" on the brand panel, "light" elsewhere. */
  tone?: 'light' | 'dark';
};

/** Footer with the business Instagram (spec 003, CA-08). */
const SiteFooter = ({ tone = 'light' }: SiteFooterProps) => {
  const t = useTranslations('core.footer');
  const muted = tone === 'dark' ? 'text-zinc-400' : 'text-default-500';
  const link =
    tone === 'dark' ? 'text-zinc-300 hover:text-white' : 'text-default-600 hover:text-foreground';

  return (
    <footer className={`flex flex-wrap items-center justify-between gap-3 text-xs ${muted}`}>
      <span>{t('rights', { year: new Date().getFullYear() })}</span>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 font-medium transition-colors ${link}`}
      >
        <InstagramIcon />
        <span className="sr-only">{t('instagram')}: </span>
        @motorismodetail
        <span className="sr-only"> {t('newTab')}</span>
      </a>
    </footer>
  );
};

export default SiteFooter;
