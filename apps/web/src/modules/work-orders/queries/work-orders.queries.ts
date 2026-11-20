import { queryOptions } from '@tanstack/react-query';

import {
  fetchActiveEmployees,
  fetchActiveServices,
  fetchCustomerOrders,
  fetchCustomerVehicles,
  searchCustomers,
} from '@web/modules/work-orders/api/work-orders.client';
import { orderKeys } from '@web/modules/work-orders/queries/work-orders.keys';

/** Catalogs change rarely while an order is put together: keep them a few minutes. */
const CATALOG_STALE_TIME = 5 * 60_000;

export const customerSearchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: orderKeys.customers(q),
    queryFn: () => searchCustomers(q),
    enabled: q.trim().length >= 2,
  });

export const customerVehiclesQueryOptions = (customerId: string) =>
  queryOptions({
    queryKey: orderKeys.vehicles(customerId),
    queryFn: () => fetchCustomerVehicles(customerId),
  });

export const activeServicesQueryOptions = () =>
  queryOptions({
    queryKey: orderKeys.services(),
    queryFn: fetchActiveServices,
    staleTime: CATALOG_STALE_TIME,
  });

export const activeEmployeesQueryOptions = () =>
  queryOptions({
    queryKey: orderKeys.employees(),
    queryFn: fetchActiveEmployees,
    staleTime: CATALOG_STALE_TIME,
  });

export const customerHistoryQueryOptions = (customerId: string) =>
  queryOptions({
    queryKey: orderKeys.history(customerId),
    queryFn: () => fetchCustomerOrders(customerId),
  });
