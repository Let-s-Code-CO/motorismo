import { useTranslations } from 'next-intl';
import Link from 'next/link';

type VehicleCatalogTabsProps = { current: 'catalog' | 'plateCities' };

const TABS = [
  { key: 'catalog', href: '/admin/vehicle-catalog' },
  { key: 'plateCities', href: '/admin/vehicle-catalog/plate-cities' },
] as const;

/**
 * The tabs of «Marcas y líneas» (spec 018): the brands and lines, and the cities of the plate with
 * their legend (spec 023, HU-03). Links, each with its own address; the current one is marked.
 */
const VehicleCatalogTabs = ({ current }: VehicleCatalogTabsProps) => {
  const t = useTranslations('vehicles.catalogTabs');

  return (
    <nav aria-label={t('label')}>
      <ul className="inline-flex gap-1 rounded-medium bg-default-100 p-1">
        {TABS.map(({ key, href }) => {
          const isCurrent = key === current;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`inline-flex h-8 items-center rounded-small px-3 text-sm transition-colors ${
                  isCurrent
                    ? 'bg-content1 font-medium text-foreground shadow-small'
                    : 'text-default-600 hover:text-foreground'
                }`}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default VehicleCatalogTabs;
