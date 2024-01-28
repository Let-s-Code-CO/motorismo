import { OrderPage } from '../pages/OrderPage';
import { CustomerPage } from '../pages/CustomerPage';
import { CustomerReportPage } from '../pages/admin/CustomerReportPage';
import { ServiceReportPage } from '../pages/admin/ServiceReportPage';

const base = import.meta.env.REACT_BASE_URL;

export default [
  { id: 1, title: 'Registro de clientes', url: `${base}/customers`, component: CustomerPage },
  { id: 2, title: 'Crear orden de trabajo', url: `${base}/order`, component: OrderPage },
  { id: 3, title: 'Reporte clientes', url: `${base}/customers-report`, admin: true, component: CustomerReportPage },
  { id: 4, title: 'Reporte servicios', url: `${base}/services-report`, admin: true, component: ServiceReportPage },
];
