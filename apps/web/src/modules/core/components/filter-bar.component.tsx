'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@heroui/react';
import { X } from 'lucide-react';

type FilterBarProps = {
  /** What the list shows, e.g. "1 de 4 usuarios · Invitados". Announced politely. */
  text: string;
  /** Whether a filter is active (only then "Ver todos" is offered). */
  showReset: boolean;
  onReset: () => void;
};

/**
 * The line above a filtered list (project standard, spec 003 CA-09 / spec 004 CA-17): what is
 * shown and, while filtering, a quiet "Ver todos" button — never a chip.
 */
const FilterBar = ({ text, showReset, onReset }: FilterBarProps) => {
  const t = useTranslations('core.filter');

  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <p aria-live="polite" className="text-sm text-default-500">
        {text}
      </p>
      {showReset && (
        <Button
          size="sm"
          variant="light"
          radius="full"
          className="shrink-0 font-medium text-default-600 motion-safe:animate-fade-in"
          startContent={<X aria-hidden className="size-3.5" />}
          onPress={onReset}
        >
          {t('reset')}
        </Button>
      )}
    </div>
  );
};

export default FilterBar;
