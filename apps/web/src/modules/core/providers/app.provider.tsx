'use client';

import { type ReactNode, useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { HeroUIProvider } from '@heroui/react';

import PwaProvider from '@web/modules/pwa/providers/pwa.provider';

type AppProviderProps = {
  children: ReactNode;
};

/**
 * Client-side providers shared by every page: server-state cache and the UI library; plus, on
 * every page, the installable app (spec 006).
 */
const AppProvider = ({ children }: AppProviderProps) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider locale="es">
        <PwaProvider>{children}</PwaProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
};

export default AppProvider;
