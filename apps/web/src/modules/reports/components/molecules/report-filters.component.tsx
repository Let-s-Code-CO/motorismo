'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Input, Select, SelectItem, SelectSection } from '@heroui/react';
import { Search } from 'lucide-react';

import { reportPlate } from '@web/modules/reports/schemas/reports.schema';
import type {
  ReportFilters as Filters,
  ReportEmployee,
} from '@web/modules/reports/types/reports.types';
import { reportHref } from '@web/modules/reports/utils/report-query.utils';
import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';

const PLATE_DELAY_MS = 300;
/** The key of «Todos los empleados» in the list (an employee's key is their id). */
const ALL = 'all';

type ReportFiltersProps = {
  filters: Filters;
  /** Every employee, also the disabled ones (CA-03). */
  employees: ReportEmployee[];
};

/**
 * The filters of the services report (spec 015, HU-01): period, employee and plate. They live in
 * the address (CA-05): each change replaces it, on page 1, and the server renders the report again.
 * The plate waits until the person stops typing (CA-04).
 */
const ReportFilters = ({ filters, employees }: ReportFiltersProps) => {
  const t = useTranslations('reports.filters');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [plate, setPlate] = useState(formatPlate(filters.plate));
  const lastSent = useRef(filters.plate);
  const active = employees.filter((employee) => !employee.disabled_at);
  const disabled = employees.filter((employee) => employee.disabled_at);

  const navigate = (next: Partial<Filters>) =>
    startTransition(() =>
      router.replace(reportHref({ ...filters, ...next, page: 1 }), { scroll: false })
    );

  // The address changed from outside («Quitar filtros», «atrás»): show its plate in the box.
  useEffect(() => {
    if (filters.plate !== lastSent.current) {
      lastSent.current = filters.plate;
      setPlate(formatPlate(filters.plate));
    }
  }, [filters.plate]);

  useEffect(() => {
    const next = reportPlate(plate);
    if (next === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = next;
      navigate({ plate: next });
    }, PLATE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only typing triggers a search
  }, [plate]);

  // CA-02: the period is never upside down: the other end moves with the one chosen.
  const changeFrom = (from: string) => {
    if (!from) return;
    navigate({ from, to: from > filters.to ? from : filters.to });
  };
  const changeTo = (to: string) => {
    if (!to) return;
    navigate({ from: to < filters.from ? to : filters.from, to });
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(2,minmax(0,10rem))_minmax(0,16rem)_minmax(0,12rem)]"
    >
      <Input
        type="date"
        label={t('from')}
        labelPlacement="outside"
        placeholder=" "
        variant="bordered"
        value={filters.from}
        onChange={(event) => changeFrom(event.target.value)}
      />
      <Input
        type="date"
        label={t('to')}
        labelPlacement="outside"
        placeholder=" "
        variant="bordered"
        value={filters.to}
        onChange={(event) => changeTo(event.target.value)}
      />
      <Select
        // A fixed id: this Select is drawn on the server, and React Aria's own ids for its hidden
        // <select> differ between server and browser (a hydration mismatch).
        id="report-employee"
        label={t('employee')}
        labelPlacement="outside"
        variant="bordered"
        className="col-span-2 md:col-span-1"
        disallowEmptySelection
        selectedKeys={[filters.employee ?? ALL]}
        onSelectionChange={(keys) => {
          const [key] = Array.from(keys);
          if (!key) return;
          navigate({ employee: key === ALL ? null : String(key) });
        }}
        // The field says it when the one chosen is disabled; in the list, their section does.
        renderValue={(items) => items.map((item) => item.textValue).join(', ')}
      >
        {[
          <SelectItem key={ALL}>{t('allEmployees')}</SelectItem>,
          ...active.map((employee) => (
            <SelectItem key={employee.id}>{employee.full_name}</SelectItem>
          )),
          // The disabled ones took part in past services, so they are here, but apart at the end
          // and muted: they make no noise among the team of today.
          ...(disabled.length > 0
            ? [
                <SelectSection
                  key="disabled"
                  title={t('disabledSection')}
                  showDivider={false}
                  classNames={{ base: 'mt-1 border-t border-divider pt-1' }}
                >
                  {disabled.map((employee) => (
                    <SelectItem
                      key={employee.id}
                      textValue={t('disabledEmployee', { name: employee.full_name })}
                      classNames={{ title: 'text-default-500' }}
                    >
                      {employee.full_name}
                    </SelectItem>
                  ))}
                </SelectSection>,
              ]
            : []),
        ]}
      </Select>
      <Input
        type="text"
        label={t('plate')}
        labelPlacement="outside"
        placeholder={t('platePlaceholder')}
        variant="bordered"
        className="col-span-2 md:col-span-1"
        value={plate}
        onValueChange={setPlate}
        isClearable
        onClear={() => setPlate('')}
        autoCapitalize="characters"
        startContent={<Search aria-hidden className="size-4 shrink-0 text-default-400" />}
      />
    </div>
  );
};

export default ReportFilters;
