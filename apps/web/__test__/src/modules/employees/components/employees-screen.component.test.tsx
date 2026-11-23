/**
 * EmployeesScreen and EmployeesTable — «Empleados»: the list for an admin, names only for an
 * operator (spec 007, HU-02 to HU-04).
 *
 * Guards:
 * - CA-16 / RN-07: an admin sees each employee's document, phone and commission (and, spec 016, their
 *   base salary) (on phones the
 *   document and the phone go under the name); an operator sees only the names, without actions.
 * - CA-11: with no employees, an admin is invited to register the first one.
 * - CA-12: disabling asks first, then announces the result.
 * - CA-13: the disabled employees are apart, in «Desactivados», where they can be reactivated.
 */
import { fireEvent, screen } from '@testing-library/react';

import { setEmployeeDisabled } from '@web/modules/employees/actions/employees.actions';
import type { EmployeeRow } from '@web/modules/employees/api/employees.server';
import EmployeesScreen from '@web/modules/employees/components/organisms/employees-screen.component';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@web/modules/employees/actions/employees.actions', () => ({
  saveEmployee: vi.fn(),
  setEmployeeDisabled: vi.fn(),
}));

const employee = (overrides: Partial<EmployeeRow> = {}): EmployeeRow => ({
  id: '30000000-0000-4000-8000-000000000001',
  full_name: 'Elkin Estrada',
  disabled_at: null,
  details: {
    document_type: 'cc',
    document_number: '1020304050',
    phone: '3001112233',
    commission_pct: 35,
    base_salary: 1423500,
  },
  ...overrides,
});

const diego = employee({
  id: '30000000-0000-4000-8000-000000000002',
  full_name: 'Diego Desactivado',
  disabled_at: '2026-09-21T15:00:00Z',
  details: {
    document_type: 'ce',
    document_number: '987654',
    phone: null,
    commission_pct: 25,
    base_salary: 0,
  },
});

describe('EmployeesScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it("shows an admin each employee's document, phone, commission and base salary (CA-16, RN-07; spec 016, CA-01)", () => {
    renderWithProviders(<EmployeesScreen employees={[employee()]} isAdmin />);

    const row = screen.getByRole('row', { name: /Elkin Estrada/ });
    expect(row).toHaveTextContent('CC 1020304050');
    expect(row).toHaveTextContent('300 111 2233');
    expect(row).toHaveTextContent('35 %');
    expect(row).toHaveTextContent('$ 1.423.500');
  });

  it('repeats the document and the phone under the name, for phones, where those columns are hidden (CA-07, RN-07)', () => {
    renderWithProviders(<EmployeesScreen employees={[employee()]} isAdmin />);

    expect(screen.getByRole('rowheader', { name: /Elkin Estrada/ })).toHaveTextContent(
      'Elkin EstradaCC 1020304050 · 300 111 2233'
    );
  });

  it('says «Sin celular» under the name when an employee has none', () => {
    renderWithProviders(
      <EmployeesScreen
        employees={[employee({ details: { ...employee().details!, phone: null } })]}
        isAdmin
      />
    );

    expect(screen.getByRole('rowheader', { name: /Elkin Estrada/ })).toHaveTextContent(
      'CC 1020304050 · Sin celular'
    );
  });

  it('shows an operator only the names, without any action (CA-16)', () => {
    renderWithProviders(
      <EmployeesScreen employees={[employee({ details: null })]} isAdmin={false} />
    );

    expect(screen.getByRole('row', { name: /Elkin Estrada/ })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Documento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Comisión' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nuevo empleado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Acciones de/ })).not.toBeInTheDocument();
  });

  it('invites an admin to register the first employee when there is none (CA-11)', () => {
    renderWithProviders(<EmployeesScreen employees={[]} isAdmin />);

    expect(
      screen.getByText('Aún no hay empleados. Registra el primero con «Nuevo empleado».')
    ).toBeVisible();
  });

  it('asks before disabling an employee, then announces it (CA-12)', async () => {
    vi.mocked(setEmployeeDisabled).mockResolvedValue({ ok: true });
    renderWithProviders(<EmployeesScreen employees={[employee()]} isAdmin />);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Elkin Estrada' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
    expect(setEmployeeDisabled).not.toHaveBeenCalled();

    await screen.findByRole('dialog', { name: /¿Desactivar a «Elkin Estrada»?/ });
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(await inToasts().findByText('Empleado desactivado.')).toBeVisible();
    expect(setEmployeeDisabled).toHaveBeenCalledWith({
      id: '30000000-0000-4000-8000-000000000001',
      disabled: true,
    });
  });

  it('keeps the disabled employees apart, with their date, where they are reactivated (CA-13)', async () => {
    vi.mocked(setEmployeeDisabled).mockResolvedValue({ ok: true });
    renderWithProviders(<EmployeesScreen employees={[employee(), diego]} isAdmin />);

    expect(screen.queryByRole('row', { name: /Diego Desactivado/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desactivados (1)' }));
    expect(screen.getByRole('row', { name: /Diego Desactivado/ })).toHaveTextContent(
      '21 de septiembre de 2026'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Diego Desactivado' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reactivar' }));

    expect(await inToasts().findByText('Empleado reactivado.')).toBeVisible();
    expect(setEmployeeDisabled).toHaveBeenCalledWith({ id: diego.id, disabled: false });
  });
});
