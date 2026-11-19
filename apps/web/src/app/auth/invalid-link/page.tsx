import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type InvalidLinkPageProps = {
  searchParams: Promise<{ type?: string }>;
};

/** An expired, used or malformed email link (CA-15 invitation, CA-24 recovery). */
const InvalidLinkPage = async ({ searchParams }: InvalidLinkPageProps) => {
  const { type } = await searchParams;
  const t = await getTranslations('auth.invalidLink');
  const message =
    type === 'invite' ? t('invite') : type === 'recovery' ? t('recovery') : t('generic');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-default-600">{message}</p>
      {type === 'recovery' && (
        <Link href="/auth/forgot-password" className="text-primary underline">
          {t('requestNew')}
        </Link>
      )}
      <Link href="/auth/login" className="text-primary underline">
        {t('backToLogin')}
      </Link>
    </div>
  );
};

export default InvalidLinkPage;
