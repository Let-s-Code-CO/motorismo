'use client';

import { type ReactNode, useId } from 'react';

import { useTranslations } from 'next-intl';

type ServiceGroupsProps<T extends { id: string }> = {
  services: readonly T[];
  /** A package has values by category: Pro Wash or a combo (spec 024, RN-05). */
  isPackage: (service: T) => boolean;
  render: (service: T) => ReactNode;
  /** How the packages are ordered (from the cheapest up); without it, as given. */
  packageOrder?: (a: T, b: T) => number;
  /** Something more for the extras, after them («Otro» in an order). */
  extra?: ReactNode;
  /** How the items of a group are laid out. */
  itemsClassName?: string;
};

/**
 * The services to choose, in two titled groups so they are not confused (spec 024, CA-28):
 * «Paquetes» and «Servicios adicionales». Each group is named by its title; an empty one is not
 * drawn.
 */
const ServiceGroups = <T extends { id: string }>({
  services,
  isPackage,
  packageOrder,
  render,
  extra,
  itemsClassName = 'flex flex-col gap-2',
}: ServiceGroupsProps<T>) => {
  const t = useTranslations('services.combination');
  const id = useId();
  const groups = [
    {
      key: 'packages',
      items: packageOrder
        ? services.filter(isPackage).sort(packageOrder)
        : services.filter(isPackage),
      extra: null,
    },
    { key: 'extras', items: services.filter((service) => !isPackage(service)), extra },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ key, items, extra: more }) =>
        items.length === 0 && !more ? null : (
          <div
            key={key}
            role="group"
            aria-labelledby={`${id}-${key}`}
            className="flex flex-col gap-2"
          >
            <span
              id={`${id}-${key}`}
              className="font-mono text-[11px] tracking-wider text-default-500 uppercase"
            >
              {t(key)}
            </span>
            <div className={itemsClassName}>
              {items.map(render)}
              {more}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default ServiceGroups;
