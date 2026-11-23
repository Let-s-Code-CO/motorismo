/**
 * EmployeeForm — an admin registers or corrects an employee (spec 007, HU-02).
 *
 * Guards:
 * - CA-08: every problem is reported next to its field and nothing is sent.
 * - CA-07 / CA-10: registering and correcting send the typed data (the action normalises it
 *   again); the screen is told once it is saved. A new employee starts with a cédula (CC).
 * - CA-09: a document taken by a disabled employee suggests reactivating them.
 * - Spec 016, CA-01 / CA-02: the monthly base salary, in pesos with thousands («1.300.000»), is
 *   required and whole; a correction opens with the current one.
 */
import { fireEvent, screen } from '@testing-library/react';

import { saveEmployee } from '@web/modules/employees/actions/employees.actions';
import type { EmployeeRow } from '@web/modules/employees/api/employees.server';
import EmployeeForm from '@web/modules/employees/components/organisms/employee-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/employees/actions/employees.actions', () => ({ saveEmployee: vi.fn() }));

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const elkin: EmployeeRow = {
  id: '30000000-0000-4000-8000-000000000001',
  full_name: 'Elkin Estrada',
  disabled_at: null,
  details: {
    document_type: 'cc',
    document_number: '1020304050',
    phone: '3001112233',
    commission_pct: 35,
    base_salary: 1500000,
  },
};

describe('EmployeeForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('reports the missing name, document, commission and base salary, and sends nothing (CA-08; spec 016, CA-02)', async () => {
    renderWithProviders(<EmployeeForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar empleado' }));

    expect(await screen.findByText('Escribe el nombre completo.')).toBeVisible();
    expect(screen.getByText('Escribe el número de documento.')).toBeVisible();
    expect(screen.getByText('Escribe la comisión.')).toBeVisible();
    expect(screen.getByText('Escribe el salario base.')).toBeVisible();
    expect(saveEmployee).not.toHaveBeenCalled();
  });

  it('reports a commission that is not a whole percentage from 0 to 100 (CA-08)', async () => {
    renderWithProviders(<EmployeeForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    type(/Nombre completo/, 'Paula Pineda');
    type(/Número de documento/, '52123456');
    type(/Comisión/, '120');
    type(/Salario base/, '1.300.000');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar empleado' }));

    expect(await screen.findByText('Escribe un porcentaje entero entre 0 y 100.')).toBeVisible();
    expect(saveEmployee).not.toHaveBeenCalled();
  });

  it('reports a base salary that is not whole pesos of 0 or more (spec 016, CA-02)', async () => {
    renderWithProviders(<EmployeeForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    type(/Nombre completo/, 'Paula Pineda');
    type(/Número de documento/, '52123456');
    type(/Comisión/, '30');
    type(/Salario base/, '1.300.000,50');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar empleado' }));

    expect(
      await screen.findByText('Escribe el salario en pesos, sin decimales: 0 o más.')
    ).toBeVisible();
    expect(saveEmployee).not.toHaveBeenCalled();
  });

  it('registers an employee with a cédula by default and tells the screen (CA-07)', async () => {
    vi.mocked(saveEmployee).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(<EmployeeForm onSaved={onSaved} onCancel={vi.fn()} />);

    type(/Nombre completo/, 'Paula Pineda');
    type(/Número de documento/, '52.123.456');
    type(/Comisión/, '30');
    type(/Salario base/, '1.300.000');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar empleado' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveEmployee).toHaveBeenCalledWith({
      id: null,
      full_name: 'Paula Pineda',
      document_type: 'cc',
      document_number: '52123456',
      phone: null,
      commission_pct: 30,
      base_salary: 1300000,
    });
  });

  it('opens with the current data and saves the correction (CA-10)', async () => {
    vi.mocked(saveEmployee).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(<EmployeeForm employee={elkin} onSaved={onSaved} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/Celular/)).toHaveValue('300 111 2233');
    expect(screen.getByLabelText(/Salario base/)).toHaveValue('1.500.000');
    type(/Comisión/, '40');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveEmployee).toHaveBeenCalledWith({
      id: elkin.id,
      full_name: 'Elkin Estrada',
      document_type: 'cc',
      document_number: '1020304050',
      phone: '3001112233',
      commission_pct: 40,
      base_salary: 1500000,
    });
  });

  it('suggests reactivating when the document belongs to a disabled employee (CA-09)', async () => {
    vi.mocked(saveEmployee).mockResolvedValue({ ok: false, error: 'documentTakenDisabled' });
    renderWithProviders(<EmployeeForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    type(/Nombre completo/, 'Diego Otra Vez');
    type(/Número de documento/, '987654');
    type(/Comisión/, '25');
    type(/Salario base/, '0');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar empleado' }));

    expect(
      await screen.findByText(
        'Ese documento es de un empleado desactivado: reactívalo desde «Desactivados».'
      )
    ).toBeVisible();
  });
});
