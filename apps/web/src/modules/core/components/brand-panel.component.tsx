import { useTranslations } from 'next-intl';

import { Droplets, Gem, ShieldCheck, Sparkles } from 'lucide-react';

import BrandBadge from '@web/modules/core/components/brand-badge.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';
import Sparkle from '@web/modules/core/components/sparkle.component';

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
      className="relative hidden flex-col overflow-hidden bg-zinc-950 p-12 text-white lg:flex xl:p-16"
    >
      {/* Ambient light, a fading grid and a slow shine sweep. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_30%,rgba(255,255,255,0.10),transparent_70%),radial-gradient(45%_45%_at_90%_95%,rgba(161,161,170,0.14),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_30%_35%,black_20%,transparent_75%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -inset-y-1/4 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent motion-safe:animate-shine" />
      </div>

      <div className="relative flex items-center gap-3">
        <BrandBadge size={40} alt="" />
        <span className="text-sm font-semibold tracking-tight">{t('name')}</span>
      </div>

      <div className="relative my-auto flex flex-col gap-10 py-12">
        <div className="relative w-fit">
          <div aria-hidden className="absolute -inset-10 rounded-full bg-white/10 blur-3xl" />
          {/* Metallic ring around the badge. */}
          <div className="relative rounded-full bg-[conic-gradient(from_210deg,#f4f4f5,#52525b,#d4d4d8,#27272a,#e4e4e7,#52525b,#f4f4f5)] p-[3px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
            <div className="rounded-full bg-zinc-950 p-1.5">
              <BrandBadge size={148} alt={t('logoAlt')} priority />
            </div>
          </div>
          <Sparkle className="absolute -top-3 right-2 text-white" size={22} />
          <Sparkle className="absolute top-1/2 -right-8 text-zinc-300" size={14} delay="1.1s" />
          <Sparkle className="absolute -bottom-2 left-4 text-zinc-400" size={12} delay="2s" />
        </div>

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
