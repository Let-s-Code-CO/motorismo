/**
 * ReportFilters — the filters of the services report: period, employee and plate (spec 015,
 * HU-01).
 *
 * Guards:
 * - CA-05: each change goes to the address (replacing it, not piling up history), on page 1, and
 *   keeps the other filters; the screen is rendered again by the server from it.
 * - CA-02: choosing a «Desde» after «Hasta» (or the other way round) moves the other end with it,
 *   so the period is never empty by mistake.
 * - CA-03: the list has «Todos», the active employees and, apart at the end under «Desactivados», the
 *   disabled ones (they took part in past services but make no noise); the field says it if one is
 *   chosen.
 * - CA-04: the plate waits until the person stops typing (300 ms), so each key is not a request.
 * - When the address changes from outside («Quitar filtros», «atrás»), the boxes show it.
 * - Several changes on their way at once (a period or an employee chosen while the plate waits, a
 *   plate typed slowly on a slow network): each builds on the newest asked for, so none undoes
 *   another, and an older answer arriving late does not overwrite the plate being typed.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';

import ReportFilters from '@web/modules/reports/components/molecules/report-filters.component';
import type {
  ReportFilters as Filters,
  ReportEmployee,
} from '@web/modules/reports/types/reports.types';

import { renderWithProviders } from '@tests/test-utils/render';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const ELKIN = '6f1d2c3b-4a59-4e8f-9b0a-1c2d3e4f5a6b';
const DIEGO = '7a2e3d4c-5b6a-4f90-8c1b-2d3e4f5a6b7c';
const EMPLOYEES: ReportEmployee[] = [
  { id: DIEGO, full_name: 'Diego Desactivado', disabled_at: '2026-10-01T00:00:00Z' },
  { id: ELKIN, full_name: 'Elkin Estrada', disabled_at: null },
];

const filters = (overrides: Partial<Filters> = {}): Filters => ({
  from: '2026-11-01',
  to: '2026-11-23',
  employee: null,
  plate: '',
  page: 3,
  ...overrides,
});

const renderFilters = (state = filters()) =>
  renderWithProviders(<ReportFilters filters={state} employees={EMPLOYEES} />);

describe('ReportFilters', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the filters of the address (CA-05)', () => {
    renderFilters(filters({ plate: 'UIH03D' }));

    expect(screen.getByLabelText('Desde')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-23');
    expect(screen.getByRole('textbox', { name: 'Placa' })).toHaveValue('UIH-03D');
  });

  it('goes to the new period on page 1, keeping the other filters (CA-02, CA-05)', () => {
    renderFilters(filters({ plate: 'UIH03D' }));

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-05' } });

    expect(replace).toHaveBeenCalledWith(
      '/reports/services?from=2026-10-05&to=2026-11-23&plate=UIH03D',
      { scroll: false }
    );
  });

  it('moves «Hasta» with a «Desde» after it, and «Desde» with a «Hasta» before it (CA-02)', () => {
    renderFilters();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-25' } });
    expect(replace).toHaveBeenLastCalledWith('/reports/services?from=2026-11-25&to=2026-11-25', {
      scroll: false,
    });

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
    expect(replace).toHaveBeenLastCalledWith('/reports/services?from=2026-10-31&to=2026-10-31', {
      scroll: false,
    });
  });

  it('ignores a date box left empty (the period always has both ends)', () => {
    renderFilters();

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '' } });

    expect(replace).not.toHaveBeenCalled();
  });

  it('lists «Todos» and the active employees first, and goes to the one chosen (CA-03)', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /Empleado/ }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Todos los empleados',
      'Elkin Estrada',
      'Diego Desactivado',
    ]);

    fireEvent.click(options[1]!);

    expect(replace).toHaveBeenCalledWith(
      `/reports/services?from=2026-11-01&to=2026-11-23&employee=${ELKIN}`,
      { scroll: false }
    );
  });

  it('keeps the disabled employees apart, at the end, under «Desactivados», so they make no noise (CA-03)', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /Empleado/ }));
    const disabled = within(screen.getByRole('listbox')).getByRole('group', {
      name: 'Desactivados',
    });
    expect(
      within(disabled)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Diego Desactivado']);

    fireEvent.click(within(disabled).getByRole('option', { name: 'Diego Desactivado' }));

    expect(replace).toHaveBeenCalledWith(
      `/reports/services?from=2026-11-01&to=2026-11-23&employee=${DIEGO}`,
      { scroll: false }
    );
  });

  it('says on the field that the chosen employee is disabled (CA-03)', () => {
    renderFilters(filters({ employee: DIEGO }));

    expect(screen.getByRole('button', { name: /Empleado/ })).toHaveTextContent(
      'Diego Desactivado (desactivado)'
    );
  });

  it('goes back to every employee with «Todos los empleados» (CA-03)', () => {
    renderFilters(filters({ employee: ELKIN }));

    fireEvent.click(screen.getByRole('button', { name: /Empleado/ }));
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: 'Todos los empleados' })
    );

    expect(replace).toHaveBeenCalledWith('/reports/services?from=2026-11-01&to=2026-11-23', {
      scroll: false,
    });
  });

  it('waits 300 ms after the last key before going to the plate (CA-04)', () => {
    renderFilters();
    const plate = screen.getByRole('textbox', { name: 'Placa' });

    fireEvent.change(plate, { target: { value: 'uih' } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(plate, { target: { value: 'uih-03d' } });
    act(() => vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      '/reports/services?from=2026-11-01&to=2026-11-23&plate=UIH03D',
      { scroll: false }
    );
  });

  it('keeps an employee chosen while the plate waits: the plate does not undo it (CA-05)', () => {
    renderFilters();

    fireEvent.change(screen.getByRole('textbox', { name: 'Placa' }), {
      target: { value: 'uih-03d' },
    });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.click(screen.getByRole('button', { name: /Empleado/ }));
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: 'Elkin Estrada' })
    );
    act(() => vi.advanceTimersByTime(200));

    expect(replace).toHaveBeenLastCalledWith(
      `/reports/services?from=2026-11-01&to=2026-11-23&employee=${ELKIN}&plate=UIH03D`,
      { scroll: false }
    );
  });

  it('keeps a period chosen while the plate waits (CA-05)', () => {
    renderFilters();

    fireEvent.change(screen.getByRole('textbox', { name: 'Placa' }), {
      target: { value: 'uih-03d' },
    });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-05' } });
    act(() => vi.advanceTimersByTime(200));

    expect(replace).toHaveBeenLastCalledWith(
      '/reports/services?from=2026-10-05&to=2026-11-23&plate=UIH03D',
      { scroll: false }
    );
  });

  it('builds a change on the one before it, even before the server answers (CA-05)', () => {
    renderFilters();

    fireEvent.click(screen.getByRole('button', { name: /Empleado/ }));
    fireEvent.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: 'Elkin Estrada' })
    );
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-05' } });

    expect(replace).toHaveBeenLastCalledWith(
      `/reports/services?from=2026-10-05&to=2026-11-23&employee=${ELKIN}`,
      { scroll: false }
    );
  });

  it('keeps the plate being typed when the answer to an older plate arrives late (CA-04)', () => {
    const { rerender } = renderFilters();
    const plate = screen.getByRole('textbox', { name: 'Placa' });

    fireEvent.change(plate, { target: { value: 'uih' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(plate, { target: { value: 'uih-03d' } });
    act(() => vi.advanceTimersByTime(300));
    // A slow network: «UIH» comes back after «UIH03D» went out.
    rerender(<ReportFilters filters={filters({ plate: 'UIH', page: 1 })} employees={EMPLOYEES} />);

    expect(screen.getByRole('textbox', { name: 'Placa' })).toHaveValue('uih-03d');
  });

  it('shows the filters of a new address, e.g. after «Quitar filtros» (CA-05, CA-08)', () => {
    const { rerender } = renderFilters(filters({ plate: 'UIH03D' }));

    rerender(<ReportFilters filters={filters({ plate: '' })} employees={EMPLOYEES} />);

    expect(screen.getByRole('textbox', { name: 'Placa' })).toHaveValue('');
    act(() => vi.advanceTimersByTime(300));
    // Showing the new address is not a new search.
    expect(replace).not.toHaveBeenCalled();
  });
});
