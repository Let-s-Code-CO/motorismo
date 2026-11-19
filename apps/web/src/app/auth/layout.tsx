import type { ReactNode } from 'react';

import { getTranslations } from 'next-intl/server';
import Image from 'next/image';

/** Shell of the public auth pages: logo, business name and a card. */
const AuthLayout = async ({ children }: { children: ReactNode }) => {
  const t = await getTranslations('core.brand');

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-large border border-divider bg-content1 p-8 shadow-small">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image src="/logo.png" alt={t('logoAlt')} width={88} height={88} priority />
          <p className="text-sm font-medium text-default-500">{t('name')}</p>
        </div>
        {children}
      </div>
    </main>
  );
};

export default AuthLayout;
