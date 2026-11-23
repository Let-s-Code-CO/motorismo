import { redirect } from 'next/navigation';

/** «Reportes» (spec 015, RF-01): for now its one report; the payroll will join it later. */
const ReportsPage = () => redirect('/reports/services');

export default ReportsPage;
