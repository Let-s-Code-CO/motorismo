'use client';

import { useTranslations } from 'next-intl';

import { Radio, RadioGroup } from '@heroui/react';

import useClock from '@web/modules/core/hooks/clock.hook';
import type {
  AgendaDayState,
  AgendaSlot,
} from '@web/modules/reservations/types/reservations.types';

type SlotPickerProps = {
  state: AgendaDayState;
  slots: AgendaSlot[];
  value: string | null;
  onChange: (slotStart: string) => void;
  /** A reservation being changed keeps its own slot choosable, though it takes one of its seats. */
  ownSlot?: string | null;
  label: string;
  errorMessage?: string;
};

/**
 * The slots of the chosen day (spec 012, CA-03), each with its free seats («1 de 2 libres»). Full
 * ones and the ones that have started show, but cannot be chosen; a closed day or a week not
 * enabled says so and offers none.
 */
const SlotPicker = ({
  state,
  slots,
  value,
  onChange,
  ownSlot,
  label,
  errorMessage,
}: SlotPickerProps) => {
  const t = useTranslations('reservations.day');
  const clock = useClock();

  if (state !== 'open') {
    return (
      <div
        role="status"
        className="rounded-medium border border-dashed border-default-300 p-4 text-sm"
      >
        <p className="font-medium">{t(state === 'closed' ? 'closed' : 'unenabled')}</p>
        <p className="text-default-500">{t(state === 'closed' ? 'closedText' : 'unenabledText')}</p>
      </div>
    );
  }

  return (
    <RadioGroup
      label={label}
      value={value}
      onValueChange={onChange}
      isInvalid={!!errorMessage}
      errorMessage={errorMessage}
      classNames={{ wrapper: 'grid gap-2 sm:grid-cols-2' }}
    >
      {slots.map((slot) => {
        const own = slot.slot_start === ownSlot;
        const free = slot.seats - slot.taken + (own ? 1 : 0);
        const range = t('slot', {
          start: clock(new Date(slot.slot_start)),
          end: clock(new Date(slot.slot_end)),
        });
        const status = slot.started
          ? t('started')
          : free <= 0
            ? t('full')
            : t('seats', { free, seats: slot.seats });

        return (
          <Radio
            key={slot.slot_start}
            value={slot.slot_start}
            isDisabled={slot.started || free <= 0}
            description={status}
            classNames={{
              base: 'm-0 max-w-none rounded-medium border border-divider px-3 py-2 data-[selected=true]:border-foreground',
            }}
          >
            {range}
          </Radio>
        );
      })}
    </RadioGroup>
  );
};

export default SlotPicker;
