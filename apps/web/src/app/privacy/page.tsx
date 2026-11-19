import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import BrandBadge from '@web/modules/core/components/brand-badge.component';
import SiteFooter from '@web/modules/core/components/site-footer.component';

type Section = { title: string; body: string[] };

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('core.privacy');
  return { title: t('metaTitle') };
};

/**
 * Data-processing policy (spec 004, RF-03, RN-04), under Colombian law (Ley 1581 de 2012). Public
 * for everyone, with or without a session; the sign-up form links here.
 */
const PrivacyPage = async () => {
  const t = await getTranslations('core');
  const sections = t.raw('privacy.sections') as Section[];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-divider">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <BrandBadge size={34} alt="" />
            <span className="text-sm font-semibold tracking-tight">{t('brand.name')}</span>
          </span>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-medium px-3 py-1.5 text-sm font-medium text-default-600 transition-colors hover:bg-default-100 hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {t('privacy.back')}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <article className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {t('privacy.title')}
            </h1>
            <p className="text-sm text-default-500">{t('privacy.updated')}</p>
            <p className="mt-2 leading-relaxed text-default-700">{t('privacy.intro')}</p>
          </div>
          {sections.map(({ title, body }) => (
            <section key={title} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-default-700">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>
      </main>

      <div className="border-t border-divider">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
