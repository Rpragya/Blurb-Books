import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useOnline } from '../../api/ApiContext';
import { ThemeToggle } from '../../app/theme';
import { useMemberSession } from '../../session/MemberSession';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { EASE_OUT_EXPO } from '../../ui/motion';

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Blurb Books — home">
      <span className="brand__symbol">
        <Icon name="book" size={22} />
      </span>
      <span className="brand__name">
        Blurb<span>Books</span>
      </span>
    </Link>
  );
}

export function KioskLayout() {
  const { session, endSession, lastEnded, dismissEndedNotice } = useMemberSession();
  const online = useOnline();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  // Header: transparent over the landing hero, solid once scrolled, tucked
  // away while scrolling down and back as soon as the reader scrolls up.
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useMotionValueEvent(scrollY, 'change', (y) => {
    setScrolled(y > 24);
    setHidden(y > last.current && y > 320);
    last.current = y;
  });

  return (
    <div className={`kiosk${isLanding ? ' kiosk--landing' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header
        className="site-header"
        data-overlay={isLanding && !scrolled ? 'true' : undefined}
        data-hidden={hidden ? 'true' : undefined}
      >
        <div className="container site-header__inner">
          <Brand />
          <nav aria-label="Primary" className="site-nav">
            <NavLink to="/" end>
              Discover
            </NavLink>
            <NavLink to="/search">The collection</NavLink>
            <NavLink to="/map">Library map</NavLink>
          </nav>
          <div className="site-header__member">
            <ThemeToggle />
            {session ? (
              <>
                <NavLink to="/member" className="member-chip">
                  <Icon name="user" size={17} />
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
                <Icon name="bookmark" size={17} />
                <span>My bookshelf</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <div className="toasts">
        {!online && (
          <div className="toast toast--warn" role="status">
            <Icon name="wifiOff" size={18} />
            <span>
              <strong>Offline.</strong> Showing the last information we loaded. Reserving and saving are paused.
            </span>
          </div>
        )}
        {lastEnded && (
          <div className="toast toast--ok" role="status">
            <Icon name="check" size={18} />
            <span>
              {lastEnded === 'timeout' ? 'Your session timed out' : 'Session ended'} — personal details have been cleared
              from this screen. You can keep browsing.
            </span>
            <button type="button" className="icon-button icon-button--sm" onClick={dismissEndedNotice} aria-label="Dismiss">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>

      <main id="main" className="kiosk__main">
        {/* Enter-only transition: no exit animation, so focus management and
            scroll restoration never see two pages at once. */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        >
          <Outlet />
        </motion.div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__top">
          <Brand />
          <p className="site-footer__motto">
            A more open world,
            <br />
            <em>one book at a time.</em>
          </p>
          <nav aria-label="Footer" className="site-footer__nav">
            <Link to="/">Discover</Link>
            <Link to="/search">The collection</Link>
            <Link to="/map">Library map</Link>
            <Link to="/member">My bookshelf</Link>
          </nav>
        </div>
        <div className="container site-footer__inner">
          <p>© {new Date().getFullYear()} Blurb Books. Made for the love of reading.</p>
          <p>
            Demo library — data and sign-in are simulated · <Link to="/staff">Librarian workspace</Link> · Made by Pragya Rai
          </p>
        </div>
      </footer>
    </div>
  );
}
