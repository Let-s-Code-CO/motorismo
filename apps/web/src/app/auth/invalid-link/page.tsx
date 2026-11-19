import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { Link2Off } from 'lucide-react';

import ResendConfirmationForm from '@web/modules/auth/components/organisms/resend-confirmation-form.component';

type InvalidLinkPageProps = {
  searchParams: Promise<{ type?: string }>;
};

const BUTTON =
  'inline-flex h-12 items-center justify-center rounded-medium px-6 text-sm font-medium transition-colors';

/**
 * An expired, used or malformed email link (CA-15 invitation, CA-24 recovery; spec 004 CA-05
 * sign-up confirmation, which offers a new email right here).
 */
const InvalidLinkPage = async ({ searchParams }: InvalidLinkPageProps) => {
  const { type } = await searchParams;
  const t = await getTranslations('auth.invalidLink');
  const message =
    type === 'invite' || type === 'recovery' || type === 'email' ? t(type) : t('generic');

  return (
    <div className="flex flex-col gap-6">
      <span className="grid size-12 place-items-center rounded-full bg-default-100 text-default-600">
        <Link2Off aria-hidden className="size-6" />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-default-600">{message}</p>
      </div>
      {type === 'email' && <ResendConfirmationForm />}
      <div className="flex flex-col gap-3">
        {type === 'recovery' && (
          <Link
            href="/auth/forgot-password"
            className={`${BUTTON} bg-primary text-primary-foreground hover:opacity-90`}
          >
            {t('requestNew')}
          </Link>
        )}
        <Link
          href="/auth/login"
          className={`${BUTTON} border border-default-200 hover:bg-default-100`}
        >
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  );
};

export default InvalidLinkPage;
