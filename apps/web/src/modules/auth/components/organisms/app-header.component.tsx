import { useTranslations } from 'next-intl';
import Link from 'next/link';

import UserMenu from '@web/modules/auth/components/molecules/user-menu.component';
import type { CurrentUser } from '@web/modules/auth/types/auth.types';

type AppHeaderProps = {
  user: Pick<CurrentUser, 'full_name' | 'role'>;
};

/** Header of the signed-in area. Admin-only options are not rendered for operators (CA-07). */
const AppHeader = ({ user }: AppHeaderProps) => {
  const t = useTranslations('auth.header');

  return (
    <header className="border-b border-divider">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <nav aria-label={t('navLabel')} className="flex items-center gap-6 text-sm">
          <Link href="/" className="font-semibold">
            {t('home')}
          </Link>
          {user.role === 'admin' && <Link href="/admin/users">{t('users')}</Link>}
        </nav>
        <UserMenu user={user} />
      </div>
    </header>
  );
};

export default AppHeader;
