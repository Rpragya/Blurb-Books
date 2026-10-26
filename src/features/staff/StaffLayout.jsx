import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApi, useOnline } from '../../api/ApiContext';
import { keys } from '../../api/queries';
import { usePageTitle } from '../../app/focus';
import { ThemeToggle } from '../../app/theme';
import { useStaffRole } from '../../session/StaffRole';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { fmtDateTime } from './shared';

export function useStaffOverview() {
  const api = useApi();
  return useQuery({ queryKey: keys.staffOverview, queryFn: ({ signal }) => api.getStaffOverview({ signal }), refetchInterval: 60_000 });
}

export function useDemoClock() {
  const api = useApi();
  return useQuery({ queryKey: keys.clock, queryFn: () => api.getClock(), refetchInterval: 30_000 });
}

export function StaffLayout() {
  const { isStaff, enter, exit } = useStaffRole();
  const online = useOnline();

  if (!isStaff) return <StaffGate onEnter={enter} />;

  return (
    <div className="staff">
      <a className="skip-link" href="#staff-main">
        Skip to main content
      </a>
      <header className="staff-bar">
        <Link to="/staff" className="staff-bar__brand">
          <img src="/images/blurb-logo.jpg" alt="" width={28} height={28} />
          <span>
            Blurb Books <span className="staff-bar__product">Librarian workspace</span>
          </span>
        </Link>
        <span className="staff-bar__demo" title="Role switching is simulated. Real access control belongs on the server.">
          Demo role · not secure
        </span>
        <DemoClockBadge />
        <div className="staff-bar__actions">
          <ThemeToggle className="theme-toggle--chrome" />
          <Link to="/" className="staff-bar__link">
            Kiosk view
          </Link>
          <Button size="sm" variant="ghost" onClick={exit}>
            Leave workspace
          </Button>
        </div>
      </header>
      {!online && (
        <div className="banner banner--offline" role="status">
          <div className="banner__inner">
            <Icon name="wifiOff" size={18} />
            <span>
              <strong>Offline.</strong> Lists show the last data loaded. Checkouts, returns and other circulation actions are
              disabled until the connection returns — nothing is queued locally.
            </span>
          </div>
        </div>
      )}
      <div className="staff-shell">
        <StaffNav />
        <main id="staff-main" className="staff-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DemoClockBadge() {
  const clock = useDemoClock();
  if (!clock.data) return null;
  const shifted = clock.data.offsetMs !== 0;
  return (
    <Link to="/staff/simulation" className={`staff-bar__clock${shifted ? ' is-shifted' : ''}`}>
      <Icon name="clock" size={14} />
      {fmtDateTime(clock.data.now)}
      {shifted && <span className="visually-hidden"> (demo clock advanced)</span>}
    </Link>
  );
}

function StaffNav() {
  const overview = useStaffOverview();
  const d = overview.data;
  const items = [
    ['/staff', 'Overview', undefined, undefined],
    ['/staff/desk', 'Checkout & return', undefined, undefined],
    ['/staff/sessions', 'Reading sessions', d?.activeSessions.length, undefined],
    ['/staff/loans', 'Loans', d?.overdue.length, 'danger'],
    ['/staff/reservations', 'Reservations', d ? d.readyForPickup.length + d.expiredPickups.length : undefined, 'accent'],
    ['/staff/reshelving', 'Reshelving', d?.reshelving.length, undefined],
    ['/staff/catalogue', 'Catalogue & copies', undefined, undefined],
    ['/staff/reports', 'Missing & misplaced', d?.openReports.length, 'danger'],
    ['/staff/simulation', 'Demo controls', undefined, undefined],
  ];
  return (
    <nav className="staff-nav" aria-label="Workspace">
      <ul role="list">
        {items.map(([to, label, count, tone]) => (
          <li key={to}>
            <NavLink to={to} end={to === '/staff'}>
              <span>{label}</span>
              {count !== undefined && count > 0 && (
                <span className={`count${tone ? ` count--${tone}` : ''}`}>
                  {count}
                  <span className="visually-hidden">{tone === 'danger' ? ' need attention' : ''}</span>
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StaffGate({ onEnter }) {
  usePageTitle('Librarian workspace');
  return (
    <main id="staff-main" className="container narrow-page staff-gate">
      <img src="/images/blurb-logo.jpg" alt="" width={64} height={64} />
      <h1 tabIndex={-1} data-page-heading>
        Librarian workspace
      </h1>
      <p>
        Circulation desk, copy management, reservations and reports. In a real deployment this would require a staff login
        checked by the server on every request.
      </p>
      <p className="demo-callout">
        <Icon name="info" size={18} /> This demo uses a role switch instead of authentication. It is not secure and doesn’t try to be.
      </p>
      <div className="staff-gate__actions">
        <Button variant="primary" size="lg" onClick={onEnter}>
          Enter as librarian (demo)
        </Button>
        <Link to="/">Back to the kiosk</Link>
      </div>
    </main>
  );
}
