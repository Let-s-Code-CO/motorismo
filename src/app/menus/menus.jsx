import { OrderPage } from '../pages/OrderPage';
import { CustomerPage } from '../pages/CustomerPage';
import { CustomerReportPage } from '../pages/admin/CustomerReportPage';
import { ServiceReportPage } from '../pages/admin/ServiceReportPage';

export default [
  { id: 1, title: 'Registro de clientes', url: '/customers', component: CustomerPage },
  { id: 2, title: 'Crear orden de trabajo', url: '/order', component: OrderPage },
  { id: 3, title: 'Reporte clientes', url: '/customers-report', admin: true, component: CustomerReportPage },
  { id: 4, title: 'Reporte servicios', url: '/services-report', admin: true, component: ServiceReportPage },
];
