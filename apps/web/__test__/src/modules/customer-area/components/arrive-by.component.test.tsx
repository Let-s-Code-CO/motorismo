/**
 * ArriveBy — until when a customer may arrive to keep their turn (spec 014, CA-17, CA-23).
 *
 * Guards:
 * - Before that time: «Puedes llegar hasta las 10:15 a. m. para conservar tu turno».
 * - Once it has passed: «Ya pasó la hora para conservar tu turno; si llegas, entras por orden de
 *   llegada», never a time in the past.
 * - It changes by itself when that time passes with the screen open (the screen keeps time).
 */
import { act, screen } from '@testing-library/react';

import ArriveBy from '@web/modules/customer-area/components/atoms/arrive-by.component';

import { renderWithProviders } from '@tests/test-utils/render';

const GRACE = '2030-06-13T10:15:00-05:00';
const ARRIVE = 'Puedes llegar hasta las 10:15 a. m. para conservar tu turno';
const OVER = 'Ya pasó la hora para conservar tu turno; si llegas, entras por orden de llegada';

describe('ArriveBy', () => {
  beforeEach(() =>
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })
  );
  afterEach(() => vi.useRealTimers());

  it('says until when they may arrive (CA-17)', () => {
    vi.setSystemTime(new Date('2030-06-13T10:14:00-05:00'));
    renderWithProviders(<ArriveBy graceUntil={GRACE} />);

    expect(screen.getByText(ARRIVE)).toBeVisible();
  });

  it('says the time has passed, and never a time in the past (CA-23)', () => {
    vi.setSystemTime(new Date('2030-06-13T10:16:00-05:00'));
    renderWithProviders(<ArriveBy graceUntil={GRACE} />);

    expect(screen.getByText(OVER)).toBeVisible();
    expect(screen.queryByText(ARRIVE)).not.toBeInTheDocument();
  });

  it('changes by itself when the time passes with the screen open (CA-23)', () => {
    vi.setSystemTime(new Date('2030-06-13T10:14:00-05:00'));
    renderWithProviders(<ArriveBy graceUntil={GRACE} />);
    expect(screen.getByText(ARRIVE)).toBeVisible();

    act(() => vi.advanceTimersByTime(2 * 60_000));

    expect(screen.getByText(OVER)).toBeVisible();
  });
});
