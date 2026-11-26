/**
 * PayrollScreen — «Reportes» → «Liquidación»: what each employee earns in a fortnight or between two
 * dates (spec 020; spec 016 by month before).
 *
 * Guards:
 * - CA-01: per employee, active days of the period, base salary, commissions and total, each opening
 *   their detail; the total for everyone. A table on the desktop and a card per employee on a phone
 *   (both drawn; the CSS shows one). «‹ Quincena anterior» and «Quincena siguiente ›», never past the
 *   fortnight in progress.
 * - CA-05: a fortnight not closed says «Provisional»; one with nobody to pay says so.
 * - CA-06, CA-08: choosing «Desde» and «Hasta» shows a range: «Consulta», the same columns, no
 *   «Cerrar liquidación», and a way back to the fortnight in progress.
 * - CA-11, CA-12: «Cerrar liquidación» only on an ended fortnight, asked first, then announced; a
 *   closed one says by whom and when, warns of changes after, and is regenerated, asked first.
 * - CA-13, CA-16: the method is in sight and travels in the address; a closed fortnight shows the one
 *   it was closed with unless another is chosen, and then says regenerating will use it.
 * - CA-17: «Exportar a Excel» with the period and method.
 * - A refusal of the database is a floating notice (spec 013), the screen as it was.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { closePayroll, regeneratePayroll } from '@web/modules/reports/actions/payroll.actions';
import PayrollScreen from '@web/modules/reports/components/organisms/payroll-screen.component';
import type {
  PayrollLine,
  PayrollQuery,
  PayrollState,
} from '@web/modules/reports/types/reports.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, replace }),
  usePathname: () => '/reports/payroll',
}));
vi.mock('@web/modules/reports/actions/payroll.actions', () => ({
  closePayroll: vi.fn(),
  regeneratePayroll: vi.fn(),
}));

/** The fortnight in progress for these tests: the second of November 2026. */
const CURRENT = '2026-11-16';
const OCTOBER_2: PayrollQuery = {
  period: { kind: 'fortnight', start: '2026-10-16' },
  method: null,
};
const RANGE: PayrollQuery = {
  period: { kind: 'range', from: '2026-11-03', to: '2026-11-20' },
  method: null,
};

const state = (overrides: Partial<PayrollState> = {}): PayrollState => ({
  kind: 'fortnight',
  status: 'provisional',
  method: 'commercial',
  total: 1427032,
  closed_at: null,
  closed_by_name: null,
  regenerated_at: null,
  regenerated_by_name: null,
  previous_total: null,
  changed_since_close: false,
  can_close: true,
  ...overrides,
});

const CLOSED = state({
  status: 'closed',
  can_close: false,
  closed_at: '2026-11-02T15:00:00Z',
  closed_by_name: 'Carlos Díaz',
});

const line = (overrides: Partial<PayrollLine> = {}): PayrollLine => ({
  employee_id: 'e-paula',
  employee_name: 'Paula Pineda',
  active_days: 15,
  period_days: 16,
  base_salary: 1300000,
  base_pay: 650000,
  commission_pct: 40,
  commissions: 48000,
  total: 698000,
  ...overrides,
});

const LINES = [
  line({
    employee_id: 'e-elkin',
    employee_name: 'Elkin Estrada',
    active_days: 16,
    base_salary: 1500000,
    base_pay: 750000,
    commissions: 26032,
    total: 776032,
  }),
  line(),
];

const renderScreen = ({
  query = OCTOBER_2,
  payroll = state(),
  lines = LINES,
}: { query?: PayrollQuery; payroll?: PayrollState; lines?: PayrollLine[] } = {}) =>
  renderWithProviders(
    <PayrollScreen query={query} currentFortnight={CURRENT} state={payroll} lines={lines} />
  );

const table = () => screen.getByRole('table', { name: 'Liquidación por empleado' });
const method = (name: string) => screen.getByRole('radio', { name });

describe('PayrollScreen — a fortnight', () => {
  afterEach(() => vi.clearAllMocks());

  it('titles the payroll and names the fortnight (CA-01)', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Liquidación de empleados' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: '2.ª quincena de octubre de 2026' })
    ).toBeVisible();
  });

  it('shows each employee with active days of the fortnight, base salary, commissions and total, opening their detail (CA-01)', () => {
    renderScreen();

    const headers = within(table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Empleado', 'Días activos', 'Salario base', 'Comisiones', 'Total']);
    const paula = within(table()).getAllByRole('row')[2]!;
    expect(
      within(paula)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Paula Pineda', '15 de 16', '$ 650.000', '$ 48.000', '$ 698.000']);
    expect(within(paula).getByRole('link', { name: 'Paula Pineda' })).toHaveAttribute(
      'href',
      '/reports/payroll/e-paula?fortnight=2026-10-2'
    );
  });

  it('shows a card per employee for phones, opening their detail (CA-01)', () => {
    renderScreen();

    const cards = within(
      screen.getByRole('list', { name: 'Liquidación por empleado' })
    ).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[1]!).getByRole('link')).toHaveAttribute(
      'href',
      '/reports/payroll/e-paula?fortnight=2026-10-2'
    );
    expect(cards[1]).toHaveTextContent('$ 698.000');
  });

  it('ends with the total of the fortnight for everyone (CA-01)', () => {
    renderScreen();

    expect(screen.getByText('Total de la quincena').nextElementSibling).toHaveTextContent(
      '$ 1.427.032'
    );
  });

  it('moves to the fortnight before and after, never past the one in progress (CA-01)', () => {
    const { unmount } = renderScreen();

    expect(screen.getByRole('link', { name: 'Quincena anterior' })).toHaveAttribute(
      'href',
      '/reports/payroll?fortnight=2026-10-1'
    );
    expect(screen.getByRole('link', { name: 'Quincena siguiente' })).toHaveAttribute(
      'href',
      '/reports/payroll?fortnight=2026-11-1'
    );
    unmount();

    renderScreen({
      query: { period: { kind: 'fortnight', start: CURRENT }, method: null },
      payroll: state({ can_close: false }),
    });
    expect(screen.queryByRole('link', { name: 'Quincena siguiente' })).not.toBeInTheDocument();
  });

  it('says a fortnight not closed is provisional (CA-05)', () => {
    renderScreen();

    expect(screen.getByText('Provisional')).toBeVisible();
    expect(screen.getByText('Se calcula con los datos de ahora y puede cambiar.')).toBeVisible();
  });

  it('says when there is nobody to pay, with nothing to close or export (CA-05)', () => {
    renderScreen({ lines: [], payroll: state({ total: 0 }) });

    expect(screen.getByText('No hay empleados que liquidar en este periodo.')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Exportar a Excel' })).not.toBeInTheDocument();
  });

  it('downloads the Excel of the fortnight with its method (CA-17)', () => {
    renderScreen({ query: { ...OCTOBER_2, method: 'actual' } });

    expect(screen.getByRole('link', { name: 'Exportar a Excel' })).toHaveAttribute(
      'href',
      '/reports/payroll/export?fortnight=2026-10-2&base=actual'
    );
  });
});

describe('PayrollScreen — a range (HU-02)', () => {
  afterEach(() => vi.clearAllMocks());

  it('turns into a range when a date is chosen (CA-06)', () => {
    renderScreen();

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-20' } });

    expect(replace).toHaveBeenCalledWith('/reports/payroll?from=2026-10-16&to=2026-10-20', {
      scroll: false,
    });
  });

  it('shows the fortnight again when the dates chosen are exactly one (CA-08)', () => {
    renderScreen({
      query: RANGE,
      payroll: state({ kind: 'range', status: 'query', can_close: false }),
    });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-16' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-30' } });

    expect(replace).toHaveBeenLastCalledWith('/reports/payroll?fortnight=2026-11-2', {
      scroll: false,
    });
  });

  it('keeps dates exactly a fortnight still to come as a query (CA-08)', () => {
    renderScreen({
      query: RANGE,
      payroll: state({ kind: 'range', status: 'query', can_close: false }),
    });

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-12-15' } });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-12-01' } });

    expect(replace).toHaveBeenLastCalledWith('/reports/payroll?from=2026-12-01&to=2026-12-15', {
      scroll: false,
    });
  });

  it('is a query: its days, the same columns and total, never closed, and a way back (CA-06, CA-08)', () => {
    renderScreen({
      query: RANGE,
      payroll: state({ kind: 'range', status: 'query', can_close: false }),
    });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Del 3 al 20 de noviembre de 2026' })
    ).toBeVisible();
    expect(screen.getByText('Consulta')).toBeVisible();
    expect(within(table()).getAllByRole('columnheader')).toHaveLength(5);
    expect(screen.getByText('Total del periodo')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cerrar liquidación' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Quincena anterior' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a la quincena en curso' })).toHaveAttribute(
      'href',
      '/reports/payroll?fortnight=2026-11-2'
    );
  });
});

describe('PayrollScreen — the method (HU-04)', () => {
  afterEach(() => vi.clearAllMocks());

  it('is «Mes comercial» unless another is chosen, and the choice travels (CA-13)', () => {
    renderScreen();

    expect(method('Mes comercial')).toBeChecked();
    fireEvent.click(method('Días reales'));

    expect(replace).toHaveBeenCalledWith('/reports/payroll?fortnight=2026-10-2&base=actual', {
      scroll: false,
    });
  });

  it('keeps the method chosen when moving to another fortnight (CA-13)', () => {
    renderScreen({
      query: { ...OCTOBER_2, method: 'actual' },
      payroll: state({ method: 'actual' }),
    });

    expect(method('Días reales')).toBeChecked();
    expect(screen.getByRole('link', { name: 'Quincena anterior' })).toHaveAttribute(
      'href',
      '/reports/payroll?fortnight=2026-10-1&base=actual'
    );
  });

  it('shows a closed fortnight with the method it was closed with (CA-16)', () => {
    renderScreen({ payroll: { ...CLOSED, method: 'actual' } });

    expect(method('Días reales')).toBeChecked();
    expect(screen.getByText('Salario base por «Días reales».')).toBeVisible();
  });

  it('says regenerating uses another method chosen for a closed fortnight (CA-16)', () => {
    renderScreen({
      query: { ...OCTOBER_2, method: 'commercial' },
      payroll: { ...CLOSED, method: 'actual' },
    });

    expect(method('Mes comercial')).toBeChecked();
    expect(screen.getByText('Al regenerarla se calculará por «Mes comercial».')).toBeVisible();
  });
});

describe('PayrollScreen — closing (HU-03)', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers to close only a fortnight that has ended (CA-11, RN-04)', () => {
    const { unmount } = renderScreen();
    expect(screen.getByRole('button', { name: 'Cerrar liquidación' })).toBeVisible();
    unmount();

    renderScreen({ payroll: state({ can_close: false }) });
    expect(screen.queryByRole('button', { name: 'Cerrar liquidación' })).not.toBeInTheDocument();
  });

  it('asks before closing, closes it with the method chosen and announces it (CA-11, CA-16)', async () => {
    vi.mocked(closePayroll).mockResolvedValue({ ok: true });
    renderScreen({
      query: { ...OCTOBER_2, method: 'actual' },
      payroll: state({ method: 'actual' }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar liquidación' }));
    const dialog = await screen.findByRole('dialog', {
      name: '¿Cerrar la liquidación de la 2.ª quincena de octubre de 2026?',
    });
    expect(closePayroll).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar liquidación' }));

    expect(
      await inToasts().findByText('Liquidación de la 2.ª quincena de octubre de 2026 cerrada.')
    ).toBeVisible();
    expect(closePayroll).toHaveBeenCalledWith({ start: '2026-10-16', method: 'actual' });
    expect(refresh).toHaveBeenCalled();
  });

  it('says a refusal of the database in a floating notice that stays (spec 013)', async () => {
    vi.mocked(closePayroll).mockResolvedValue({ ok: false, error: 'periodOpen' });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar liquidación' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar liquidación' }));

    expect(
      await inToasts().findByText(
        'Esa quincena aún no termina: se cierra cuando haya pasado su último día.'
      )
    ).toBeVisible();
  });

  it('says by whom and when a closed fortnight was closed, and offers to regenerate it (CA-12)', () => {
    renderScreen({ payroll: CLOSED });

    expect(
      screen.getByText('Cerrada el 2 de noviembre de 2026 a las 10:00 a. m. por Carlos Díaz')
    ).toBeVisible();
    expect(screen.queryByText('Provisional')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar liquidación' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerar' })).toBeVisible();
  });

  it('asks before regenerating, with the method chosen then, and announces it (CA-12, CA-16)', async () => {
    vi.mocked(regeneratePayroll).mockResolvedValue({ ok: true });
    renderScreen({
      query: { ...OCTOBER_2, method: 'commercial' },
      payroll: { ...CLOSED, method: 'actual' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Regenerar' }));
    const dialog = await screen.findByRole('dialog', {
      name: '¿Regenerar la liquidación de la 2.ª quincena de octubre de 2026?',
    });
    expect(dialog).toHaveTextContent('Los valores pueden cambiar');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerar' }));

    expect(
      await inToasts().findByText('Liquidación de la 2.ª quincena de octubre de 2026 regenerada.')
    ).toBeVisible();
    expect(regeneratePayroll).toHaveBeenCalledWith({ start: '2026-10-16', method: 'commercial' });
  });

  it('says by whom and when it was regenerated, and the total before (CA-12)', () => {
    renderScreen({
      payroll: {
        ...CLOSED,
        regenerated_at: '2026-11-04T21:30:00Z',
        regenerated_by_name: 'Sebastián Pulido',
        previous_total: 2100000,
      },
    });

    expect(
      screen.getByText(
        'Regenerada el 4 de noviembre de 2026 a las 4:30 p. m. por Sebastián Pulido; antes sumaba $ 2.100.000.'
      )
    ).toBeVisible();
  });

  it('warns when something changed after closing (CA-12)', () => {
    renderScreen({ payroll: { ...CLOSED, changed_since_close: true } });

    expect(
      screen.getByText(
        'Hubo cambios después del cierre. Regenérala si quieres que los tenga en cuenta.'
      )
    ).toBeVisible();
  });

  it('goes to the services report from its tabs (spec 016, RF-02)', () => {
    renderScreen();

    const tabs = screen.getByRole('navigation', { name: 'Secciones de reportes' });
    expect(within(tabs).getByRole('link', { name: 'Liquidación' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
