import { useTranslations } from 'next-intl';
import Link from 'next/link';

import NavLinks from '@web/modules/auth/components/molecules/nav-links.component';
import UserMenu from '@web/modules/auth/components/molecules/user-menu.component';
import type { CurrentUser } from '@web/modules/auth/types/auth.types';
import BrandBadge from '@web/modules/core/components/brand-badge.component';

type AppHeaderProps = {
  user: Pick<CurrentUser, 'full_name' | 'role' | 'avatar_url'>;
};

/** Sticky, translucent header of the signed-in area. Admin options only for admins (CA-07). */
const AppHeader = ({ user }: AppHeaderProps) => {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-40 border-b border-divider bg-background/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          aria-label={t('auth.header.brandLabel')}
          className="flex items-center gap-2.5 rounded-medium"
        >
          <BrandBadge size={34} alt="" />
          <span className="hidden text-sm font-semibold tracking-tight md:inline">
            {t('core.brand.short')}
          </span>
        </Link>
        <nav aria-label={t('auth.header.navLabel')}>
          <NavLinks role={user.role} />
        </nav>
        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
