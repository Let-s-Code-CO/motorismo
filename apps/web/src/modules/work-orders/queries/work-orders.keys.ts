/** Query keys of «Nueva orden» (TanStack Query). */
export const orderKeys = {
  all: ['orders'] as const,
  customers: (q: string) => [...orderKeys.all, 'customers', q] as const,
  vehicles: (customerId: string) => [...orderKeys.all, 'vehicles', customerId] as const,
  services: () => [...orderKeys.all, 'services'] as const,
  employees: () => [...orderKeys.all, 'employees'] as const,
  history: (customerId: string) => [...orderKeys.all, 'history', customerId] as const,
};
