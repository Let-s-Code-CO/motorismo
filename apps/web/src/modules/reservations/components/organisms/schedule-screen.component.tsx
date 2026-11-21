'use client';

import { useId, useState, useTransition } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, Button, Input, Switch } from '@heroui/react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import {
  saveAgendaSettings,
  saveAgendaWeek,
} from '@web/modules/reservations/actions/reservations.actions';
import { useDayTitle } from '@web/modules/reservations/components/molecules/day-nav.component';
import DayScheduleRow from '@web/modules/reservations/components/molecules/day-schedule-row.component';
import {
  agendaSettingsSchema,
  agendaWeekSchema,
} from '@web/modules/reservations/schemas/reservations.schema';
import type {
  AgendaSettings,
  AgendaWeek,
  AgendaWeekDay,
} from '@web/modules/reservations/types/reservations.types';
import { addDays, weekDays } from '@web/modules/reservations/utils/agenda-date.utils';

type ScheduleScreenProps = { week: AgendaWeek; settings: AgendaSettings };

type Notice = { tone: 'success' | 'danger'; text: string };
type SettingsFields = { slot_minutes: string; seats: string; tolerance_minutes: string };

const CARD = 'rounded-large border border-divider bg-content1 shadow-small';

/**
 * «Horario» (spec 012, HU-05), admin only: a week (Monday to Sunday), proposed from 9:00 a. m. to
 * 6:00 p. m. every day (CA-26, RN-10); any day closed or with other hours (CA-27); enabled or not
 * (CA-28); a day that cannot hold a full slot is said next to it (CA-30). Below, the slot length,
 * the seats and the general tolerance (CA-29).
 */
const ScheduleScreen = ({ week, settings }: ScheduleScreenProps) => {
  const t = useTranslations('reservations');
  const router = useRouter();
  const format = useFormatter();
  const dayTitle = useDayTitle('short');
  const days = weekDays(week.week_start);
  const [schedule, setSchedule] = useState<AgendaWeekDay[]>(week.days);
  const [enabled, setEnabled] = useState(week.enabled || !week.saved);
  const [dayErrors, setDayErrors] = useState<Record<number, string>>({});
  // Each save speaks next to its own button: the settings are at the bottom of the page (CA-29).
  const [weekNotice, setWeekNotice] = useState<Notice>();
  const [settingsNotice, setSettingsNotice] = useState<Notice>();
  const weekTitleId = useId();
  const settingsTitleId = useId();
  const [fields, setFields] = useState<SettingsFields>({
    slot_minutes: String(settings.slot_minutes),
    seats: String(settings.seats),
    tolerance_minutes: String(settings.tolerance_minutes),
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SettingsFields, string>>>({});
  const [savingWeek, startWeek] = useTransition();
  const [savingSettings, startSettings] = useTransition();

  const changeDay = (index: number, day: AgendaWeekDay) =>
    setSchedule((current) => current.map((item, i) => (i === index ? day : item)));

  const saveWeek = () => {
    const input = { week_start: week.week_start, enabled, days: schedule };
    const parsed = agendaWeekSchema(settings.slot_minutes).safeParse(input);
    if (!parsed.success) {
      setDayErrors(
        Object.fromEntries(
          parsed.error.issues
            .filter((issue) => issue.path[0] === 'days')
            .map((issue) => [Number(issue.path[1]), t(`validation.${issue.message}`)])
        )
      );
      return;
    }
    setDayErrors({});
    startWeek(async () => {
      const result = await callAction(() => saveAgendaWeek(input));
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (result.ok) {
        setWeekNotice({ tone: 'success', text: t('scheduleScreen.saved') });
        router.refresh();
        return;
      }
      const index = result.day ? days.indexOf(result.day) : -1;
      if (index >= 0) setDayErrors({ [index]: t('validation.dayInvalid') });
      setWeekNotice({ tone: 'danger', text: t(`errors.${result.error}`) });
    });
  };

  const saveSettings = () => {
    const parsed = agendaSettingsSchema.safeParse(fields);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], t(`validation.${issue.message}`)])
        )
      );
      return;
    }
    setFieldErrors({});
    startSettings(async () => {
      const result = await callAction(() => saveAgendaSettings(parsed.data));
      if (!result) return;
      setSettingsNotice(
        result.ok
          ? { tone: 'success', text: t('scheduleScreen.settingsSaved') }
          : { tone: 'danger', text: t(`errors.${result.error}`) }
      );
      if (result.ok) router.refresh();
    });
  };

  const setting = (name: keyof SettingsFields, label: string) => (
    <Input
      type="number"
      inputMode="numeric"
      label={label}
      labelPlacement="outside"
      variant="bordered"
      value={fields[name]}
      onValueChange={(value) => setFields((current) => ({ ...current, [name]: value }))}
      isInvalid={!!fieldErrors[name]}
      errorMessage={fieldErrors[name]}
    />
  );

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={`/agenda?date=${week.week_start}`}
        className="flex w-max items-center gap-1 text-sm text-default-500 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('detail.back')}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('scheduleScreen.title')}</h1>
        <p className="text-default-500">{t('scheduleScreen.description')}</p>
      </div>

      <nav aria-label={t('scheduleScreen.title')} className="flex items-center gap-2">
        <Button
          as={Link}
          href={`/agenda/schedule?week=${addDays(week.week_start, -7)}`}
          isIconOnly
          variant="bordered"
          aria-label={t('scheduleScreen.previousWeek')}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <h2 id={weekTitleId} className="min-w-0 flex-1 text-center font-semibold tracking-tight">
          {t('scheduleScreen.week', {
            // «del 30 de noviembre al 6 de diciembre» when the week changes month.
            from: format.dateTime(
              new Date(`${days[0]}T12:00:00-05:00`),
              days[0]!.slice(5, 7) === days[6]!.slice(5, 7)
                ? { day: 'numeric' }
                : { day: 'numeric', month: 'long' }
            ),
            to: format.dateTime(new Date(`${days[6]}T12:00:00-05:00`), {
              day: 'numeric',
              month: 'long',
            }),
          })}
        </h2>
        <Button
          as={Link}
          href={`/agenda/schedule?week=${addDays(week.week_start, 7)}`}
          isIconOnly
          variant="bordered"
          aria-label={t('scheduleScreen.nextWeek')}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </nav>

      <section aria-labelledby={weekTitleId} className={`${CARD} flex flex-col`}>
        <div className="flex flex-col gap-1 border-b border-divider p-4">
          <Switch isSelected={enabled} onValueChange={setEnabled}>
            {t('scheduleScreen.enabled')}
          </Switch>
          <p className="text-sm text-default-500">
            {enabled ? t('scheduleScreen.enabledText') : t('scheduleScreen.disabledText')}
          </p>
          {!week.saved && (
            <p className="text-sm text-default-500">{t('scheduleScreen.proposal')}</p>
          )}
        </div>
        <ul className="flex flex-col divide-y divide-divider">
          {schedule.map((day, index) => (
            <DayScheduleRow
              key={days[index]}
              title={dayTitle(days[index]!)}
              day={day}
              onChange={(next) => changeDay(index, next)}
              errorMessage={dayErrors[index]}
            />
          ))}
        </ul>
        <div className="flex flex-col gap-3 border-t border-divider p-4">
          <Button
            color="primary"
            className="w-max font-medium"
            isLoading={savingWeek}
            onPress={saveWeek}
          >
            {t('scheduleScreen.save')}
          </Button>
          {weekNotice && <Alert color={weekNotice.tone} variant="faded" title={weekNotice.text} />}
        </div>
      </section>

      <section aria-labelledby={settingsTitleId} className={`${CARD} flex flex-col gap-4 p-5`}>
        <h2 id={settingsTitleId} className="font-semibold tracking-tight">
          {t('scheduleScreen.settingsTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {setting('slot_minutes', t('scheduleScreen.slotMinutes'))}
          {setting('seats', t('scheduleScreen.seats'))}
          {setting('tolerance_minutes', t('scheduleScreen.tolerance'))}
        </div>
        <Button
          variant="bordered"
          className="w-max"
          isLoading={savingSettings}
          onPress={saveSettings}
        >
          {t('scheduleScreen.saveSettings')}
        </Button>
        {settingsNotice && (
          <Alert color={settingsNotice.tone} variant="faded" title={settingsNotice.text} />
        )}
      </section>
    </section>
  );
};

export default ScheduleScreen;
