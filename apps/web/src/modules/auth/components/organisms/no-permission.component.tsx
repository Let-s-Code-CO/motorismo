import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { ShieldX } from 'lucide-react';

/** Shown instead of a page the user's role may not see (CA-08). */
const NoPermission = () => {
  const t = useTranslations('auth.noPermission');

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-default-100 text-default-600">
        <ShieldX aria-hidden className="size-7" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-default-500">{t('text')}</p>
      </div>
      <Link
        href="/"
        className="inline-flex h-10 items-center rounded-medium bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {t('backHome')}
      </Link>
    </section>
  );
};

export default NoPermission;
