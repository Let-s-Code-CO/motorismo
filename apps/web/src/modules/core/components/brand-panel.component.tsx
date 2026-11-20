import { useTranslations } from 'next-intl';

import { Droplets, Gem, ShieldCheck, Sparkles } from 'lucide-react';

import BrandBadge from '@web/modules/core/components/brand-badge.component';
import BrandOrnaments from '@web/modules/core/components/brand-ornaments.component';
import BrandRingLogo from '@web/modules/core/components/brand-ring-logo.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';

const SERVICES = [
  { key: 'ppf', Icon: ShieldCheck },
  { key: 'ceramic', Icon: Gem },
  { key: 'polish', Icon: Sparkles },
  { key: 'wash', Icon: Droplets },
] as const;

/**
 * Brand side of the auth pages (spec 003, CA-03): logo on a metallic ring with sparkles, the
 * business promise and its services. Every ornament is decorative and motion respects
 * prefers-reduced-motion.
 */
const BrandPanel = () => {
  const t = useTranslations('core.brand');

  return (
    <aside
      aria-label={t('name')}
      className="relative hidden flex-col overflow-hidden bg-zinc-950 p-12 text-white lg:flex xl:p-16 dark:border-r dark:border-white/10"
    >
      <BrandOrnaments />

      <div className="relative flex items-center gap-3">
        <BrandBadge size={40} alt="" />
        <span className="text-sm font-semibold tracking-tight">{t('name')}</span>
      </div>

      <div className="relative my-auto flex flex-col gap-10 py-12">
        <BrandRingLogo size={148} alt={t('logoAlt')} priority />

        <h2 className="max-w-lg bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-5xl leading-[1.05] font-semibold tracking-tight text-balance text-transparent xl:text-6xl">
          {t('tagline')}
        </h2>

        <ul aria-label={t('servicesLabel')} className="grid max-w-xl grid-cols-2 gap-3">
          {SERVICES.map(({ key, Icon }) => (
            <li
              key={key}
              className="flex items-start gap-3 rounded-large border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.07]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-medium bg-white/10 ring-1 ring-white/15">
                <Icon aria-hidden className="size-4 text-zinc-100" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium text-white">{t(`services.${key}.title`)}</span>
                <span className="text-xs text-zinc-400">{t(`services.${key}.text`)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative">
        <SiteFooter tone="dark" />
      </div>
    </aside>
  );
};

export default BrandPanel;
