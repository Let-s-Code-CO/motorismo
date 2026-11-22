/**
 * ScheduleScreen — «Horario»: the admin enables the agenda week by week (spec 012, HU-05).
 *
 * Guards:
 * - CA-26 / RN-10: a week never saved proposes its seven days, Monday first, open from 9:00 to
 *   18:00, ready to enable.
 * - CA-27: closing a day or changing its hours changes only that day.
 * - CA-28: the week is saved enabled or not.
 * - CA-30: a day that closes before it opens, or cannot hold a full slot, is said next to it and
 *   nothing is sent; a refusal of the database names the day too.
 * - CA-29: the settings (slot length, seats, tolerance) are checked next to each field and saved.
 * - A save that went well says so in a floating notice (spec 013, CA-01); a refusal stays inside
 *   its form, right below its own button: the week's in the week's card, the settings' in the
 *   settings' card (spec 013, CA-08; at the bottom of the page, a notice at the top goes unseen).
 */
import { fireEvent, screen, within } from '@testing-library/react';

import {
  saveAgendaSettings,
  saveAgendaWeek,
} from '@web/modules/reservations/actions/reservations.actions';
import ScheduleScreen from '@web/modules/reservations/components/organisms/schedule-screen.component';
import type { AgendaWeek } from '@web/modules/reservations/types/reservations.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/reservations/actions/reservations.actions', () => ({
  saveAgendaWeek: vi.fn(),
  saveAgendaSettings: vi.fn(),
}));

const PROPOSAL = { is_open: true, opens_at: '09:00', closes_at: '18:00' };

const week = (overrides: Partial<AgendaWeek> = {}): AgendaWeek => ({
  week_start: '2026-11-23',
  enabled: false,
  saved: false,
  days: Array.from({ length: 7 }, () => PROPOSAL),
  ...overrides,
});

const renderSchedule = (agendaWeek: AgendaWeek = week()) =>
  renderWithProviders(
    <ScheduleScreen
      week={agendaWeek}
      settings={{ slot_minutes: 60, seats: 2, tolerance_minutes: 15 }}
    />
  );

const dayRow = (name: RegExp) => screen.getByRole('listitem', { name });
const weekCard = () => screen.getByRole('region', { name: /^Semana del/ });
const settingsCard = () => screen.getByRole('region', { name: 'Configuración de la agenda' });
const saveWeek = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar semana' }));

describe('ScheduleScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it('proposes the seven days of a new week, open from 9:00 to 18:00, and enables it (CA-26, RN-10)', async () => {
    vi.mocked(saveAgendaWeek).mockResolvedValue({ ok: true });
    renderSchedule();

    expect(screen.getByText('Semana del 23 al 29 de noviembre')).toBeVisible();
    expect(screen.getByText('Propuesta: todos los días de 9:00 a. m. a 6:00 p. m.')).toBeVisible();
    expect(screen.getAllByRole('listitem').map((item) => item.getAttribute('aria-label'))).toEqual([
      'lunes, 23 de noviembre',
      'martes, 24 de noviembre',
      'miércoles, 25 de noviembre',
      'jueves, 26 de noviembre',
      'viernes, 27 de noviembre',
      'sábado, 28 de noviembre',
      'domingo, 29 de noviembre',
    ]);
    expect(screen.getByRole('switch', { name: 'Semana habilitada' })).toBeChecked();
    saveWeek();

    await vi.waitFor(() =>
      expect(saveAgendaWeek).toHaveBeenCalledWith({
        week_start: '2026-11-23',
        enabled: true,
        days: Array.from({ length: 7 }, () => PROPOSAL),
      })
    );
    expect(await inToasts().findByText('Semana guardada.')).toBeVisible();
    expect(within(weekCard()).queryByText('Semana guardada.')).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it('closes one day and shortens another, leaving the rest (CA-27)', async () => {
    vi.mocked(saveAgendaWeek).mockResolvedValue({ ok: true });
    renderSchedule(week({ saved: true, enabled: true }));

    fireEvent.click(within(dayRow(/domingo/)).getByRole('switch', { name: /Abierto/ }));
    fireEvent.change(within(dayRow(/sábado/)).getByLabelText('Cierra'), {
      target: { value: '13:00' },
    });
    saveWeek();

    await vi.waitFor(() => expect(saveAgendaWeek).toHaveBeenCalled());
    const { days } = vi.mocked(saveAgendaWeek).mock.calls[0]![0] as AgendaWeek;
    expect(days.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => PROPOSAL));
    expect(days[5]).toEqual({ is_open: true, opens_at: '09:00', closes_at: '13:00' });
    expect(days[6]).toEqual({ ...PROPOSAL, is_open: false });
    // A closed day shows no hours.
    expect(within(dayRow(/domingo/)).queryByLabelText('Abre')).not.toBeInTheDocument();
  });

  it('saves a week disabled (CA-28)', async () => {
    vi.mocked(saveAgendaWeek).mockResolvedValue({ ok: true });
    renderSchedule(week({ saved: true, enabled: true }));

    fireEvent.click(screen.getByRole('switch', { name: 'Semana habilitada' }));
    expect(screen.getByText('Sin habilitar, nadie puede reservar en esta semana.')).toBeVisible();
    saveWeek();

    await vi.waitFor(() =>
      expect(saveAgendaWeek).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
    );
  });

  it('says next to a day that cannot hold a full slot, and sends nothing (CA-30)', () => {
    renderSchedule();

    // 9:00 to 9:30 is shorter than one slot of 60 minutes.
    fireEvent.change(within(dayRow(/martes/)).getByLabelText('Cierra'), {
      target: { value: '09:30' },
    });
    saveWeek();

    expect(
      within(dayRow(/martes/)).getByText(
        'Debe cerrar después de abrir y caber al menos una franja completa.'
      )
    ).toBeVisible();
    expect(saveAgendaWeek).not.toHaveBeenCalled();
  });

  it('puts a refusal of the database next to the day it names (CA-30)', async () => {
    vi.mocked(saveAgendaWeek).mockResolvedValue({
      ok: false,
      error: 'dayInvalid',
      day: '2026-11-25',
    });
    renderSchedule();
    const saveButton = screen.getByRole('button', { name: 'Guardar semana' });
    saveWeek();

    const refusal = await within(weekCard()).findByText('Revisa el horario del día marcado.');
    expect(refusal).toBeVisible();
    // Right below the button, where the eyes already are; not a floating notice.
    expect(
      saveButton.compareDocumentPosition(refusal) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(inToasts().queryByText('Revisa el horario del día marcado.')).not.toBeInTheDocument();
    expect(
      within(dayRow(/miércoles/)).getByText(
        'Debe cerrar después de abrir y caber al menos una franja completa.'
      )
    ).toBeVisible();
  });

  it('checks the settings next to each field, then saves them (CA-29)', async () => {
    vi.mocked(saveAgendaSettings).mockResolvedValue({ ok: true });
    renderSchedule();
    const save = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    fireEvent.change(screen.getByLabelText('Duración de cada franja (minutos)'), {
      target: { value: '50' },
    });
    fireEvent.change(screen.getByLabelText('Puestos por franja'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Tolerancia de llegada (minutos)'), {
      target: { value: '61' },
    });
    save();
    expect(screen.getByText('De 15 a 240 minutos, de 15 en 15.')).toBeVisible();
    expect(screen.getByText('De 1 a 20 puestos.')).toBeVisible();
    expect(screen.getByText('De 0 a 60 minutos.')).toBeVisible();
    expect(saveAgendaSettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Duración de cada franja (minutos)'), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByLabelText('Puestos por franja'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Tolerancia de llegada (minutos)'), {
      target: { value: '10' },
    });
    save();

    await vi.waitFor(() =>
      expect(saveAgendaSettings).toHaveBeenCalledWith({
        slot_minutes: 30,
        seats: 3,
        tolerance_minutes: 10,
      })
    );
    expect(await inToasts().findByText('Configuración guardada.')).toBeVisible();
    expect(within(settingsCard()).queryByText('Configuración guardada.')).not.toBeInTheDocument();
    expect(within(weekCard()).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says a refusal of the settings next to their button, not at the top (CA-29)', async () => {
    vi.mocked(saveAgendaSettings).mockResolvedValue({ ok: false, error: 'generic' });
    renderSchedule();

    const button = screen.getByRole('button', { name: 'Guardar configuración' });
    fireEvent.click(button);

    const notice = await within(settingsCard()).findByRole('alert');
    expect(notice).toBeVisible();
    // Right below the button, where the eyes already are.
    expect(button.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(weekCard()).queryByRole('alert')).not.toBeInTheDocument();
  });
});
