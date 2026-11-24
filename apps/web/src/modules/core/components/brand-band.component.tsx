import { useTranslations } from 'next-intl';

import BrandOrnaments from '@web/modules/core/components/brand-ornaments.component';
import BrandRingLogo from '@web/modules/core/components/brand-ring-logo.component';

/**
 * The brand on top of the sign-in pages on a phone or tablet, where the side panel does not fit
 * (spec 009, HU-03): a dark band with the logo on its silver ring, sparkles, the moving shine and
 * the business promise (CA-10). Short, so the form stays in sight (CA-11): no service cards here.
 * On a tall phone the band takes half of the spare height, so the form sits centred below it
 * instead of leaving a gap at the bottom. The business name is the band's accessible name, announced once (CA-12); the promise is a
 * paragraph, not a heading, so the form's title stays the page's heading.
 */
const BrandBand = () => {
  const t = useTranslations('core.brand');

  return (
    <header
      aria-label={t('name')}
      className="relative flex flex-auto items-center overflow-hidden bg-zinc-950 px-6 py-8 text-white lg:hidden dark:border-b dark:border-white/10"
    >
      <BrandOrnaments />
      <div className="relative mx-auto flex w-full max-w-sm items-center gap-9">
        <BrandRingLogo size={84} alt={t('logoAlt')} priority />
        <p className="bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-2xl leading-tight font-semibold tracking-tight text-balance text-transparent">
          {t('tagline')}
        </p>
      </div>
    </header>
  );
};

export default BrandBand;
