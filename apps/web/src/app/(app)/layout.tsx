import type { ReactNode } from 'react';

import { requireUser } from '@web/modules/auth/api/auth.server';
import AppHeader from '@web/modules/auth/components/organisms/app-header.component';

/** Signed-in area (RF-01). The proxy already redirected visitors; this is the second check. */
const AppLayout = async ({ children }: { children: ReactNode }) => {
  const user = await requireUser();

  return (
    <>
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
};

export default AppLayout;
