import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { listEmployees } from '@web/modules/employees/api/employees.server';
import EmployeesScreen from '@web/modules/employees/components/organisms/employees-screen.component';

/**
 * «Empleados» (spec 007): staff only (a customer gets "no permission", CA-18). An admin manages the
 * list with each employee's details; an operator reads the names of the active ones (CA-16). RLS
 * decides what each one gets.
 */
const EmployeesPage = async () => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const isAdmin = staff.role === 'admin';
  const employees = await listEmployees(isAdmin);

  return <EmployeesScreen employees={employees} isAdmin={isAdmin} />;
};

export default EmployeesPage;
