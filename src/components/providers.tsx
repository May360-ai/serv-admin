'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { useState } from 'react';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" storageKey="serv-tema" disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      {children}
      <Notifications />
    </QueryClientProvider>
    </ThemeProvider>
  );
}

function Notifications() {
  const { resolvedTheme } = useTheme();
  return (<Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        position="top-right"
        richColors
        closeButton
        duration={4000}
      />);
}
