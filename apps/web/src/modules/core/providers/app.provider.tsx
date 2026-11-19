'use client';

import { type ReactNode, useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { HeroUIProvider } from '@heroui/react';

type AppProviderProps = {
  children: ReactNode;
};

/** Client-side providers shared by every page: server-state cache and the UI library. */
const AppProvider = ({ children }: AppProviderProps) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider locale="es">{children}</HeroUIProvider>
    </QueryClientProvider>
  );
};

export default AppProvider;
