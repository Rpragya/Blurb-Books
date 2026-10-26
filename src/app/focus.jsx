import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Focus management across route changes.
 *
 * - On a forward navigation, focus moves to the new page's <h1> so keyboard
 *   and screen-reader users start at the top of the new content.
 * - On Back/Forward (POP), focus returns to the element the user activated
 *   on that page, if one was remembered (e.g. the book card they opened).
 */
const memory = new Map();

const locationKey = (pathname, search) => pathname + search;

/** Remember which element to refocus when the user comes back to this URL. */
export function rememberFocus(selector, at = window.location) {
  memory.set(locationKey(at.pathname, at.search), selector);
}

export function RouteFocus() {
  const location = useLocation();
  const navigationType = useNavigationType();
  // Compare with the previous path (not a "first run" flag) so StrictMode's
  // double-invoked effects don't treat the initial load as a navigation.
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    const key = locationKey(location.pathname, location.search);
    const selector = navigationType === 'POP' ? memory.get(key) : undefined;
    let frame = 0;
    let attempts = 0;
    // Content may still be rendering (cached data paints on the next frame);
    // retry briefly before falling back to the heading.
    const tryFocus = () => {
      const target =
        (selector && document.querySelector(selector)) ||
        (attempts > 20 || !selector ? document.querySelector('[data-page-heading]') : null);
      if (target) {
        target.focus({ preventScroll: navigationType === 'POP' });
        if (selector) memory.delete(key);
        return;
      }
      if (attempts++ < 40) frame = requestAnimationFrame(tryFocus);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(frame);
    // Only pathname changes count as a new page; filter changes keep focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
}

/** Page <h1> that receives focus after navigation. */
export function PageHeading({ children, className, id }) {
  return (
    <h1 tabIndex={-1} data-page-heading className={className} id={id}>
      {children}
    </h1>
  );
}

export function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = `${title} · Blurb Books`;
  }, [title]);
}
