import type { AgendaWeekDay } from '@web/modules/reservations/types/reservations.types';

export const AGENDA_PATH = '/agenda';

/** RN-10: enabling a week proposes every day from 9:00 a. m. to 6:00 p. m. */
export const PROPOSED_DAY: AgendaWeekDay = { is_open: true, opens_at: '09:00', closes_at: '18:00' };
