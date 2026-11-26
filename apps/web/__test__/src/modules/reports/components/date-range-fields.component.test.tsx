/**
 * DateRangeFields — «Desde» and «Hasta» of a report (spec 015, CA-02) and of the payroll (spec 020,
 * CA-06), the same two fields in both.
 *
 * Guards:
 * - it shows the two days of the period;
 * - the period is never upside down: a «Desde» after «Hasta» moves «Hasta» with it, and a «Hasta»
 *   before «Desde» moves «Desde» (so a range is always valid, CA-09);
 * - it builds on the newest period asked for, not on the one still drawn (a change on its way is not
 *   undone, project standard of `useUrlFilters`);
 * - a field emptied by the person changes nothing.
 */
import { fireEvent, screen } from '@testing-library/react';

import DateRangeFields from '@web/modules/reports/components/molecules/date-range-fields.component';

import { renderWithProviders } from '@tests/test-utils/render';

const draw = (latest?: () => { from: string; to: string }) => {
  const onChange = vi.fn();
  renderWithProviders(
    <DateRangeFields
      value={{ from: '2026-11-03', to: '2026-11-20' }}
      latest={latest}
      onChange={onChange}
    />
  );
  return { onChange, from: screen.getByLabelText('Desde'), to: screen.getByLabelText('Hasta') };
};

describe('DateRangeFields', () => {
  it('shows the two days of the period', () => {
    const { from, to } = draw();

    expect(from).toHaveValue('2026-11-03');
    expect(to).toHaveValue('2026-11-20');
  });

  it('keeps «Hasta» when «Desde» moves within the period', () => {
    const { onChange, from } = draw();

    fireEvent.change(from, { target: { value: '2026-11-10' } });

    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-10', to: '2026-11-20' });
  });

  it('moves «Hasta» with a «Desde» after it: never upside down (CA-02)', () => {
    const { onChange, from } = draw();

    fireEvent.change(from, { target: { value: '2026-11-25' } });

    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-25', to: '2026-11-25' });
  });

  it('moves «Desde» with a «Hasta» before it (CA-02)', () => {
    const { onChange, to } = draw();

    fireEvent.change(to, { target: { value: '2026-11-01' } });

    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-01' });
  });

  it('builds on the newest period asked for, not on the one still drawn', () => {
    const { onChange, to } = draw(() => ({ from: '2026-11-15', to: '2026-11-20' }));

    fireEvent.change(to, { target: { value: '2026-11-18' } });

    expect(onChange).toHaveBeenCalledWith({ from: '2026-11-15', to: '2026-11-18' });
  });

  it('changes nothing when a field is emptied', () => {
    const { onChange, from } = draw();

    fireEvent.change(from, { target: { value: '' } });

    expect(onChange).not.toHaveBeenCalled();
  });
});
