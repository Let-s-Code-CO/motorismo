/**
 * PayrollScreen — «Reportes» → «Liquidación»: what each employee earns in a month (spec 016,
 * HU-02 to HU-04).
 *
 * Guards:
 * - CA-05: per employee, active days, base salary of the month, commissions and total, each one
 *   opening their detail (CA-11); the total of the month for everyone. A table on the desktop and
 *   a card per employee on a phone (both drawn; the CSS shows one).
 * - CA-05: «Mes anterior» and «Mes siguiente» move by month, never past the month in progress.
 * - CA-12: a month not closed says «Provisional»; «Cerrar liquidación» only once it has ended
 *   (CA-14, RN-06), asked first, then announced.
 * - CA-15 / CA-16: a closed month says by whom and when; «Regenerar» asks first, warning the values
 *   may change; a regenerated one says by whom, when and the total before.
 * - CA-17: «Hubo cambios después del cierre».
 * - CA-13: a month with nobody to pay says so.
 * - CA-18: «Exportar a Excel» with the month.
 * - A refusal of the database is a floating notice (spec 013), the screen as it was.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { closePayroll, regeneratePayroll } from '@web/modules/reports/actions/payroll.actions';
import PayrollScreen from '@web/modules/reports/components/organisms/payroll-screen.component';
import type { PayrollLine, PayrollMonth } from '@web/modules/reports/types/reports.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => '/reports/payroll',
}));
vi.mock('@web/modules/reports/actions/payroll.actions', () => ({
  closePayroll: vi.fn(),
  regeneratePayroll: vi.fn(),
}));

const state = (overrides: Partial<PayrollMonth> = {}): PayrollMonth => ({
  month: '2026-10-01',
  status: 'provisional',
  total: 2226002,
  closed_at: null,
  closed_by_name: null,
  regenerated_at: null,
  regenerated_by_name: null,
  previous_total: null,
  changed_since_close: false,
  can_close: true,
  ...overrides,
});

const line = (overrides: Partial<PayrollLine> = {}): PayrollLine => ({
  employee_id: 'e-paula',
  employee_name: 'Paula Pineda',
  active_days: 15,
  month_days: 31,
  base_salary: 1300000,
  base_pay: 629032,
  commission_pct: 40,
  commissions: 48000,
  total: 677032,
  ...overrides,
});

const LINES = [
  line({
    employee_id: 'e-elkin',
    employee_name: 'Elkin Estrada',
    active_days: 31,
    base_salary: 1500000,
    base_pay: 1500000,
    commissions: 48970,
    total: 1548970,
  }),
  line(),
];

const renderScreen = ({
  month = '2026-10',
  current = '2026-11',
  payroll = state(),
  lines = LINES,
}: { month?: string; current?: string; payroll?: PayrollMonth; lines?: PayrollLine[] } = {}) =>
  renderWithProviders(
    <PayrollScreen month={month} currentMonth={current} state={payroll} lines={lines} />
  );

const table = () => screen.getByRole('table', { name: 'Liquidación por empleado' });

describe('PayrollScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it('titles the payroll and names the month (CA-05)', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Liquidación de empleados' })
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Octubre de 2026' })).toBeVisible();
  });

  it('shows each employee with active days, base of the month, commissions and total, opening their detail (CA-05, CA-11)', () => {
    renderScreen();

    const headers = within(table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual(['Empleado', 'Días activos', 'Salario del mes', 'Comisiones', 'Total']);
    const paula = within(table()).getAllByRole('row')[2]!;
    expect(
      within(paula)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Paula Pineda', '15 de 31', '$ 629.032', '$ 48.000', '$ 677.032']);
    expect(within(paula).getByRole('link', { name: 'Paula Pineda' })).toHaveAttribute(
      'href',
      '/reports/payroll/e-paula?month=2026-10'
    );
  });

  it('shows a card per employee for phones, opening their detail (CA-05, CA-11)', () => {
    renderScreen();

    const cards = within(
      screen.getByRole('list', { name: 'Liquidación por empleado' })
    ).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[1]!).getByRole('link')).toHaveAttribute(
      'href',
      '/reports/payroll/e-paula?month=2026-10'
    );
    expect(cards[1]).toHaveTextContent('$ 677.032');
  });

  it('ends with the total of the month for everyone (CA-05)', () => {
    renderScreen();

    expect(screen.getByText('Total del mes').nextElementSibling).toHaveTextContent('$ 2.226.002');
  });

  it('moves to the month before and after, never past the month in progress (CA-05)', () => {
    const { unmount } = renderScreen();

    expect(screen.getByRole('link', { name: 'Mes anterior' })).toHaveAttribute(
      'href',
      '/reports/payroll?month=2026-09'
    );
    expect(screen.getByRole('link', { name: 'Mes siguiente' })).toHaveAttribute(
      'href',
      '/reports/payroll?month=2026-11'
    );
    unmount();

    renderScreen({ month: '2026-11', payroll: state({ can_close: false }) });
    expect(screen.queryByRole('link', { name: 'Mes siguiente' })).not.toBeInTheDocument();
  });

  it('says a month not closed is provisional (CA-12)', () => {
    renderScreen();

    expect(screen.getByText('Provisional')).toBeVisible();
    expect(screen.getByText('Se calcula con los datos de ahora y puede cambiar.')).toBeVisible();
  });

  it('offers to close only a month that has ended (CA-14, RN-06)', () => {
    const { unmount } = renderScreen();
    expect(screen.getByRole('button', { name: 'Cerrar liquidación' })).toBeVisible();
    unmount();

    renderScreen({ month: '2026-11', payroll: state({ can_close: false }) });
    expect(screen.queryByRole('button', { name: 'Cerrar liquidación' })).not.toBeInTheDocument();
  });

  it('asks before closing, closes the month and announces it (CA-14)', async () => {
    vi.mocked(closePayroll).mockResolvedValue({ ok: true });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar liquidación' }));
    const dialog = await screen.findByRole('dialog', {
      name: '¿Cerrar la liquidación de octubre de 2026?',
    });
    expect(closePayroll).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar liquidación' }));

    expect(await inToasts().findByText('Liquidación de octubre de 2026 cerrada.')).toBeVisible();
    expect(closePayroll).toHaveBeenCalledWith({ month: '2026-10' });
    expect(refresh).toHaveBeenCalled();
  });

  it('says a refusal of the database in a floating notice that stays (spec 013)', async () => {
    vi.mocked(closePayroll).mockResolvedValue({ ok: false, error: 'monthOpen' });
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar liquidación' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar liquidación' }));

    expect(
      await inToasts().findByText(
        'Ese mes aún no termina: se cierra desde el día 1 del mes siguiente.'
      )
    ).toBeVisible();
  });

  it('says by whom and when a closed month was closed, and offers to regenerate it (CA-15, CA-16)', () => {
    renderScreen({
      payroll: state({
        status: 'closed',
        can_close: false,
        closed_at: '2026-11-02T15:00:00Z',
        closed_by_name: 'Carlos Díaz',
      }),
    });

    expect(
      screen.getByText('Cerrada el 2 de noviembre de 2026 a las 10:00 a. m. por Carlos Díaz')
    ).toBeVisible();
    expect(screen.queryByText('Provisional')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar liquidación' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regenerar' })).toBeVisible();
  });

  it('asks before regenerating, warning the values may change, then announces it (CA-16)', async () => {
    vi.mocked(regeneratePayroll).mockResolvedValue({ ok: true });
    renderScreen({
      payroll: state({
        status: 'closed',
        can_close: false,
        closed_at: '2026-11-02T15:00:00Z',
        closed_by_name: 'Carlos Díaz',
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Regenerar' }));
    const dialog = await screen.findByRole('dialog', {
      name: '¿Regenerar la liquidación de octubre de 2026?',
    });
    expect(dialog).toHaveTextContent('Los valores pueden cambiar');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Regenerar' }));

    expect(await inToasts().findByText('Liquidación de octubre de 2026 regenerada.')).toBeVisible();
    expect(regeneratePayroll).toHaveBeenCalledWith({ month: '2026-10' });
  });

  it('says by whom and when it was regenerated, and the total before (CA-16)', () => {
    renderScreen({
      payroll: state({
        status: 'closed',
        can_close: false,
        closed_at: '2026-11-02T15:00:00Z',
        closed_by_name: 'Carlos Díaz',
        regenerated_at: '2026-11-04T21:30:00Z',
        regenerated_by_name: 'Sebastián Pulido',
        previous_total: 2100000,
      }),
    });

    expect(
      screen.getByText(
        'Regenerada el 4 de noviembre de 2026 a las 4:30 p. m. por Sebastián Pulido; antes sumaba $ 2.100.000.'
      )
    ).toBeVisible();
  });

  it('warns when something changed after closing (CA-17)', () => {
    renderScreen({
      payroll: state({
        status: 'closed',
        can_close: false,
        closed_at: '2026-11-02T15:00:00Z',
        closed_by_name: 'Carlos Díaz',
        changed_since_close: true,
      }),
    });

    expect(
      screen.getByText(
        'Hubo cambios después del cierre. Regenérala si quieres que los tenga en cuenta.'
      )
    ).toBeVisible();
  });

  it('downloads the Excel of the month (CA-18)', () => {
    renderScreen();

    expect(screen.getByRole('link', { name: 'Exportar a Excel' })).toHaveAttribute(
      'href',
      '/reports/payroll/export?month=2026-10'
    );
  });

  it('says when there is nobody to pay this month, with nothing to close or export (CA-13)', () => {
    renderScreen({ lines: [], payroll: state({ total: 0 }) });

    expect(screen.getByText('No hay empleados que liquidar en este mes.')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Exportar a Excel' })).not.toBeInTheDocument();
  });

  it('goes to the services report from its tabs (RF-02)', () => {
    renderScreen();

    const tabs = screen.getByRole('navigation', { name: 'Secciones de reportes' });
    expect(within(tabs).getByRole('link', { name: 'Liquidación' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(tabs).getByRole('link', { name: 'Servicios' })).toHaveAttribute(
      'href',
      '/reports/services'
    );
  });
});
