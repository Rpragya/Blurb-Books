import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import type { LibraryApi } from './types';

const ApiContext = createContext<LibraryApi | null>(null);

/**
 * Provides the data adapter. Components never import the mock directly, so
 * swapping in a REST adapter is a one-line change in main.tsx.
 */
export function ApiProvider({ api, children }: { api: LibraryApi; children: ReactNode }) {
  const queryClient = useQueryClient();
  // Data changed in another tab (staff desk ↔ kiosk): refetch what's on screen.
  useEffect(() => api.subscribe(() => void queryClient.invalidateQueries()), [api, queryClient]);
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useApi(): LibraryApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi must be used inside <ApiProvider>');
  return api;
}

/**
 * Online when the browser says so AND the demo hasn't simulated an outage.
 * Authoritative circulation actions are disabled while offline.
 */
export function useOnline(): boolean {
  const api = useApi();
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      const unsubscribe = api.subscribe(notify);
      return () => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
        unsubscribe();
      };
    },
    () => navigator.onLine && !api.getSettings().offline,
  );
}
