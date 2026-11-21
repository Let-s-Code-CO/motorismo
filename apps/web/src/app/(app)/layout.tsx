import { type ReactNode, Suspense } from 'react';

import { requireAccount } from '@web/modules/auth/api/auth.server';
import AppHeader from '@web/modules/auth/components/organisms/app-header.component';
import NavigationProgress from '@web/modules/core/components/navigation-progress.component';
import RealtimeRefresh from '@web/modules/core/components/realtime-refresh.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';
import InstallBanner from '@web/modules/pwa/components/install-banner.component';

/**
 * Signed-in area (RF-01) for staff and customers (spec 004). The proxy already redirected visitors;
 * this is the second check. Each page decides whether its audience may see it.
 */
const AppLayout = async ({ children }: { children: ReactNode }) => {
  const account = await requireAccount();

  return (
    // Safety net: nothing may scroll the app sideways on a phone (clip keeps the sticky header).
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      {/* While the next screen loads, a thin bar on top (spec 011, HU-02). */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      {/* Spec 012, CA-35: the staff screens stay up to date without reloading. */}
      {account.kind === 'staff' && <RealtimeRefresh />}
      <AppHeader account={account} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
        {children}
      </main>
      <div className="border-t border-divider">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <SiteFooter />
        </div>
      </div>
      {/* Spec 006, CA-18: only signed-in people are told the app can be installed. */}
      <InstallBanner />
    </div>
  );
};

export default AppLayout;
