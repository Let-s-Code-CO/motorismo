import type { ReactNode } from 'react';

import { getTranslations } from 'next-intl/server';

import BrandBadge from '@web/modules/core/components/brand-badge.component';
import BrandPanel from '@web/modules/core/components/brand-panel.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';

/** Auth pages: brand panel beside the form on desktop, form only on phones (spec 003, CA-03). */
const AuthLayout = async ({ children }: { children: ReactNode }) => {
  const t = await getTranslations('core.brand');

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <div className="flex flex-col">
        <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandBadge size={48} alt={t('logoAlt')} priority />
              <span className="font-semibold tracking-tight">{t('name')}</span>
            </div>
            {children}
          </div>
        </main>
        <div className="px-4 pb-6 sm:px-8 lg:hidden">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
