import { useTranslations } from 'next-intl';

import BrandOrnaments from '@web/modules/core/components/brand-ornaments.component';
import BrandRingLogo from '@web/modules/core/components/brand-ring-logo.component';

/**
 * A moment of the brand while the app opens after signing in (spec 011, HU-04): the logo on its
 * silver ring with its shine and sparkles, centred on black, over the whole screen. It is shown
 * only while the destination loads and goes with the sign-in page (RN-01, CA-12); its shine and
 * sparkles only move when the device allows motion (CA-14). Screen readers hear «Entrando…».
 */
const BrandMoment = () => {
  const t = useTranslations('core');

  return (
    <div
      role="status"
      aria-label={t('loading.entering')}
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-zinc-950 motion-safe:animate-fade-in"
    >
      <BrandOrnaments />
      <div className="relative">
        <BrandRingLogo size={120} alt={t('brand.logoAlt')} />
      </div>
    </div>
  );
};

export default BrandMoment;
