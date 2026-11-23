import { useTranslations } from 'next-intl';
import Link from 'next/link';

type ReportsTabsProps = { current: 'services' | 'payroll' };

const TABS = [
  { key: 'services', href: '/reports/services' },
  { key: 'payroll', href: '/reports/payroll' },
] as const;

/**
 * The reports of «Reportes» (spec 016, RF-02): the services done (spec 015) and the payroll. Links,
 * each report has its own address; the current one is marked.
 */
const ReportsTabs = ({ current }: ReportsTabsProps) => {
  const t = useTranslations('reports.tabs');

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

export default ReportsTabs;
