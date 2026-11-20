import type { ReactNode } from 'react';

import BrandBand from '@web/modules/core/components/brand-band.component';
import BrandPanel from '@web/modules/core/components/brand-panel.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';

/**
 * Auth pages: the brand panel beside the form on the desktop (spec 003, CA-03; spec 009, CA-13)
 * and, where it does not fit (phone and tablet), the brand band on top of the form (spec 009,
 * CA-10). The spare height is shared by the band and the form's area, the form centred in its
 * own, so on a phone the form sits centred below a fuller band and «Entrar» stays in sight (CA-11).
 */
const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <BrandPanel />

      <div className="flex flex-col">
        <BrandBand />
        <main className="flex flex-auto items-center justify-center px-4 py-8 sm:px-8 lg:py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <div className="px-4 pb-6 sm:px-8 lg:hidden">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
