import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { ApiProvider } from './api/ApiContext';
import { createMockApi } from './api/mock/mockApi';
import { ApiError } from './api/types';
import { createRoutes } from './app/routes';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/kiosk.css';
import './styles/staff.css';
import './styles/discovery.css';
import './styles/reference.css';
import { AnnouncerProvider } from './ui/Feedback';

// Swap this for a REST adapter implementing LibraryApi to use a real backend.
const api = createMockApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Retry transient server errors only; offline / not-found / validation are final.
      retry: (count, error) => error instanceof ApiError && error.kind === 'server' && count < 2,
      // The mock isn't on the network, so don't let navigator.onLine pause it.
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
});

const router = createBrowserRouter(createRoutes());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <AnnouncerProvider>
          {/* Honour prefers-reduced-motion for every framer-motion animation. */}
          <MotionConfig reducedMotion="user">
            <RouterProvider router={router} />
          </MotionConfig>
        </AnnouncerProvider>
      </ApiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
