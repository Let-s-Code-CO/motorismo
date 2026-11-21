import { useTranslations } from 'next-intl';

import Skeleton from '@web/modules/core/components/skeleton.component';

export type PageSkeletonVariant = 'home' | 'list' | 'detail' | 'form' | 'profile';

const CARD = 'rounded-large border border-divider bg-content1 p-5 shadow-small';

/** A title and its line below, as every screen opens. */
const Heading = ({ action = false }: { action?: boolean }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="flex flex-col gap-3">
      <Skeleton className="h-9 w-56 max-w-full" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
    {action && <Skeleton className="h-10 w-36 rounded-large" />}
  </div>
);

const Rows = ({ count }: { count: number }) => (
  <div className={`${CARD} flex flex-col divide-y divide-divider p-0`}>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </div>
        <Skeleton className="h-4 w-16 shrink-0" />
      </div>
    ))}
  </div>
);

const Fields = ({ count }: { count: number }) => (
  <div className={`${CARD} flex flex-col gap-5`}>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-large" />
      </div>
    ))}
  </div>
);

const SHAPES: Record<PageSkeletonVariant, () => React.ReactNode> = {
  // The staff home: greeting, «Órdenes» first and wide, then the section tiles (spec 009).
  home: () => (
    <>
      <Heading />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <Skeleton className="col-span-2 h-40 rounded-large md:col-span-1 md:h-52" />
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-large md:h-52" />
        ))}
      </div>
    </>
  ),
  // A list: title and its action, then rows (orders, customers, services, employees, users).
  list: () => (
    <>
      <Heading action />
      <Skeleton className="h-10 w-full max-w-md rounded-large" />
      <Rows count={6} />
    </>
  ),
  // A record or an order: back link, title, then its cards.
  detail: () => (
    <>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-9 w-48" />
      <div className={`${CARD} flex items-center gap-3`}>
        <Skeleton className="size-10 shrink-0" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Rows count={3} />
    </>
  ),
  // A form to fill in (a new order).
  form: () => (
    <>
      <Heading />
      <Fields count={3} />
    </>
  ),
  // «Mi perfil»: who they are, then their data.
  profile: () => (
    <>
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Fields count={4} />
    </>
  ),
};

type PageSkeletonProps = { variant: PageSkeletonVariant };

/**
 * The shape of a screen while its data arrive (spec 011, HU-01): heading, cards or rows where the
 * data will be (CA-01), in the theme's colours (CA-04) and the page's own width and spacing, so
 * the content takes its place without jumps or sideways scroll (CA-05). It only appears if loading
 * takes over 300 ms (CA-02, CSS). A screen reader hears «Cargando…» once, never the shapes (CA-03).
 */
const PageSkeleton = ({ variant }: PageSkeletonProps) => {
  const t = useTranslations('core.loading');
  const Shapes = SHAPES[variant];

  return (
    <div
      role="status"
      aria-busy="true"
      data-skeleton={variant}
      className="flex animate-skeleton-in flex-col gap-6"
    >
      <span className="sr-only">{t('label')}</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <Shapes />
      </div>
    </div>
  );
};

export default PageSkeleton;
