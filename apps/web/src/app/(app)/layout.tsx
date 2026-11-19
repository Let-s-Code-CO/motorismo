import type { ReactNode } from 'react';

import { requireAccount } from '@web/modules/auth/api/auth.server';
import AppHeader from '@web/modules/auth/components/organisms/app-header.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';

/**
 * Signed-in area (RF-01) for staff and customers (spec 004). The proxy already redirected visitors;
 * this is the second check. Each page decides whether its audience may see it.
 */
const AppLayout = async ({ children }: { children: ReactNode }) => {
  const account = await requireAccount();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader account={account} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      <div className="border-t border-divider">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
