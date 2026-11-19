import { useTranslations } from 'next-intl';
import Link from 'next/link';

/** Shown instead of a page the user's role may not see (CA-08). */
const NoPermission = () => {
  const t = useTranslations('auth.noPermission');

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Link href="/" className="text-primary underline">
        {t('backHome')}
      </Link>
    </section>
  );
};

export default NoPermission;
