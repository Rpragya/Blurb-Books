import { Link, NavLink, Outlet } from 'react-router-dom';
import { useOnline } from '../../api/ApiContext';
import { useMemberSession } from '../../session/MemberSession';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';

export function KioskLayout() {
  const { session, endSession, lastEnded, dismissEndedNotice } = useMemberSession();
  const online = useOnline();

  return (
    <div className="kiosk">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand" aria-label="Blurb Books — home">
            <img src="/images/blurb-logo.jpg" alt="" width={40} height={40} className="brand__logo" />
            <span className="brand__name">
              Blurb <span>Books</span>
            </span>
          </Link>
          <nav aria-label="Primary" className="site-nav">
            <NavLink to="/explore">Browse</NavLink>
            <NavLink to="/search">Search</NavLink>
            <NavLink to="/map">Library map</NavLink>
          </nav>
          <div className="site-header__member">
            {session ? (
              <>
                <NavLink to="/member" className="member-chip">
                  <Icon name="user" size={18} />
                  <span>
                    <span className="visually-hidden">Signed in as </span>
                    {session.name.split(' ')[0]}
                  </span>
                </NavLink>
                <Button size="sm" variant="ghost" onClick={() => endSession('manual')}>
                  End session
                </Button>
              </>
            ) : (
              <NavLink to="/member" className="member-chip">
                <Icon name="user" size={18} />
                <span>My library</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {!online && (
        <div className="banner banner--offline" role="status">
          <div className="container banner__inner">
            <Icon name="wifiOff" size={18} />
            <span>
              <strong>Offline.</strong> Showing the last information we loaded. Reserving and saving are paused until the
              connection returns.
            </span>
          </div>
        </div>
      )}
      {lastEnded && (
        <div className="banner banner--ok" role="status">
          <div className="container banner__inner">
            <Icon name="check" size={18} />
            <span>
              {lastEnded === 'timeout' ? 'Your session timed out' : 'Session ended'} — personal details have been cleared from
              this screen. You can keep browsing.
            </span>
            <button type="button" className="icon-button icon-button--sm" onClick={dismissEndedNotice} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      )}

      <main id="main" className="kiosk__main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>
            <strong>Demo.</strong> Library data, sign-in and circulation are simulated in this browser.{' '}
            <Link to="/staff">Librarian workspace</Link>
          </p>
          <p>
            Blurb Books — know more about your books.{' '}
            <a href="https://www.linkedin.com/in/pragya-rai-5096a21b1" target="_blank" rel="noreferrer">
              Made by Pragya Rai
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
