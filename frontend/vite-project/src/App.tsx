import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './router';
import { QueryProvider } from './providers/query';
import { useAuthStore } from './store/auth';

export function App() {
  const hydrateFromCookie = useAuthStore((state) => state.hydrateFromCookie);

  useEffect(() => {
    // Hydrate auth state from cookie on app initialization
    hydrateFromCookie();
  }, [hydrateFromCookie]);

  return (
    <QueryProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryProvider>
  );
}
