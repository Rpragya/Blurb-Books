import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { ApiProvider } from '../api/ApiContext';
import { createMockApi } from '../api/mock/mockApi';
import { createRoutes } from '../app/routes';
import { AnnouncerProvider } from '../ui/Feedback';

export function createTestApi() {
  return createMockApi({
    storage: null,
    settings: { latencyMs: [0, 0], failureRate: 0, offline: false },
    checkInvariants: true,
    crossTab: false,
  });
}

/** Render the real route tree in a memory router against an injected API. */
export function renderApp(path, options = {}) {
  const api = options.api ?? createTestApi();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' }, mutations: { networkMode: 'always' } } });
  const router = createMemoryRouter(createRoutes({ timing: options.timing }), { initialEntries: [path] });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ApiProvider api={api}>
        <AnnouncerProvider>
          <RouterProvider router={router} />
        </AnnouncerProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );
  return { ...utils, api, router, queryClient };
}
