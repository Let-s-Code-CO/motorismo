import { useTranslations } from 'next-intl';
import Link from 'next/link';

import AccountMenu from '@web/modules/auth/components/molecules/account-menu.component';
import NavLinks from '@web/modules/auth/components/molecules/nav-links.component';
import UserMenu from '@web/modules/auth/components/molecules/user-menu.component';
import MobileNav from '@web/modules/auth/components/organisms/mobile-nav.component';
import { type CurrentAccount, audienceOf } from '@web/modules/auth/types/auth.types';
import BrandBadge from '@web/modules/core/components/brand-badge.component';
import ThemeMenu from '@web/modules/theme/components/theme-menu.component';

type AppHeaderProps = {
  account: CurrentAccount;
};

/**
 * Sticky, translucent header of the signed-in area. Each role sees only its sections (spec 002,
 * CA-07; spec 004, CA-08; spec 009, RN-01).
 *
 * On a phone (below `md`), an app's header (spec 009, CA-01): «Menú» on the left (the side panel),
 * the logo centred and the avatar on the right (the account's menu). On the desktop, as before
 * (CA-05): the logo with the name, the sections inline, and the name, role, «Instalar app» and
 * «Cerrar sesión». Both are drawn and CSS shows one per width: no device check, no hydration jump.
 */
const AppHeader = ({ account }: AppHeaderProps) => {
  const t = useTranslations();
  const audience = audienceOf(account);

  return (
    <header className="sticky top-0 z-40 border-b border-divider bg-background/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-2 lg:flex lg:gap-6 lg:px-6">
        <div className="justify-self-start lg:hidden">
          <MobileNav audience={audience} />
        </div>
        <Link
          href="/"
          aria-label={t('auth.header.brandLabel')}
          className="flex items-center gap-2.5 justify-self-center rounded-medium"
        >
          <BrandBadge size={34} alt="" />
          <span className="hidden text-sm font-semibold tracking-tight xl:inline">
            {t('core.brand.short')}
          </span>
        </Link>
        {/* Takes the room between the brand and the account: the menu measures it (spec 018, HU-05). */}
        <nav aria-label={t('auth.header.navLabel')} className="hidden min-w-0 lg:block lg:flex-1">
          <NavLinks audience={audience} />
        </nav>
        <div className="justify-self-end lg:hidden">
          <AccountMenu
            name={account.full_name}
            avatarUrl={account.avatar_url}
            audience={audience}
          />
        </div>
        <div className="hidden items-center gap-2 lg:ml-auto lg:flex">
          {/* The theme's own menu: its icon is the chosen theme (spec 010, CA-10). */}
          <ThemeMenu />
          <UserMenu name={account.full_name} avatarUrl={account.avatar_url} audience={audience} />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
