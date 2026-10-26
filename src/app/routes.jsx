import { Outlet, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { BookPage } from '../features/kiosk/BookPage';
import { ExplorePage } from '../features/kiosk/ExplorePage';
import { HandoffPage } from '../features/kiosk/HandoffPage';
import { KioskLayout } from '../features/kiosk/KioskLayout';
import { MapPage } from '../features/kiosk/MapPage';
import { NotFoundPage } from '../features/kiosk/NotFoundPage';
import { SearchPage } from '../features/kiosk/SearchPage';
import { WelcomePage } from '../features/kiosk/WelcomePage';
import { MemberPage } from '../features/member/MemberPage';
import { MemberSessionProvider } from '../session/MemberSession';
import { StaffRoleProvider } from '../session/StaffRole';
import { RouteFocus } from './focus';

// The librarian workspace is a separate chunk: kiosk visitors never download it.
const staff = () => import('../features/staff/StaffRoutes');

function AppRoot({ timing }) {
  return (
    <StaffRoleProvider>
      <MemberSessionProvider timing={timing}>
        <RouteFocus />
        <ScrollRestoration />
        <Outlet />
      </MemberSessionProvider>
    </StaffRoleProvider>
  );
}

function RouteError() {
  const error = useRouteError();
  return (
    <main className="container route-error">
      <h1>{isRouteErrorResponse(error) ? `${error.status} — ${error.statusText}` : 'Something went wrong'}</h1>
      <p>Try going back, or return to the start.</p>
      <p>
        <a href="/">Back to the welcome screen</a>
      </p>
    </main>
  );
}

export function createRoutes(options = {}) {
  return [
    {
      element: <AppRoot timing={options.timing} />,
      errorElement: <RouteError />,
      children: [
        {
          element: <KioskLayout />,
          children: [
            { index: true, element: <WelcomePage /> },
            { path: 'explore', element: <ExplorePage /> },
            { path: 'search', element: <SearchPage /> },
            { path: 'books/:editionId', element: <BookPage /> },
            { path: 'books/:editionId/locate', element: <MapPage /> },
            { path: 'map', element: <MapPage /> },
            { path: 'handoff', element: <HandoffPage /> },
            { path: 'member', element: <MemberPage /> },
            { path: '*', element: <NotFoundPage /> },
          ],
        },
        {
          path: 'staff',
          lazy: async () => ({ Component: (await staff()).StaffLayout }),
          children: [
            { index: true, lazy: async () => ({ Component: (await staff()).OverviewPage }) },
            { path: 'desk', lazy: async () => ({ Component: (await staff()).DeskPage }) },
            { path: 'sessions', lazy: async () => ({ Component: (await staff()).SessionsPage }) },
            { path: 'loans', lazy: async () => ({ Component: (await staff()).LoansPage }) },
            { path: 'reservations', lazy: async () => ({ Component: (await staff()).ReservationsPage }) },
            { path: 'reshelving', lazy: async () => ({ Component: (await staff()).ReshelvingPage }) },
            { path: 'catalogue', lazy: async () => ({ Component: (await staff()).CataloguePage }) },
            { path: 'reports', lazy: async () => ({ Component: (await staff()).ReportsPage }) },
            { path: 'simulation', lazy: async () => ({ Component: (await staff()).SimulationPage }) },
          ],
        },
      ],
    },
  ];
}
