import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Icon } from '../ui/Icon';

const KEY = 'blurb-books:theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function readStored() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function subscribeSystem(notify) {
  const m = media();
  m.addEventListener('change', notify);
  return () => m.removeEventListener('change', notify);
}

/**
 * Theme follows the OS until the reader picks one; the pick is stored and
 * applied as [data-theme] on <html> (also set pre-paint by index.html).
 */
export function useTheme() {
  const [stored, setStored] = useState(readStored);
  const systemDark = useSyncExternalStore(subscribeSystem, () => media().matches, () => false);
  const theme = stored ?? (systemDark ? 'dark' : 'light');

  useEffect(() => {
    const root = document.documentElement;
    if (stored) root.dataset.theme = stored;
    else delete root.dataset.theme;
  }, [stored]);

  const setTheme = useCallback((next) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* private mode: still switch for this visit */
    }
    setStored(next);
    document.documentElement.dataset.theme = next;
  }, []);

  return { theme, setTheme };
}

/**
 * Light/dark switch. Where the View Transitions API exists, the new theme
 * spreads in a circle from the button; otherwise it just switches.
 */
export function ThemeToggle({ className = '' }) {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';

  const onClick = (event) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const doc = document;
    if (!doc.startViewTransition || reduce) {
      setTheme(next);
      return;
    }
    const { clientX: x, clientY: y } = event;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = doc.startViewTransition(() => flushSync(() => setTheme(next)));
    void transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={onClick}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-theme-current={theme}
    >
      <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
        <Icon name="sun" size={18} />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
        <Icon name="moon" size={18} />
      </span>
    </button>
  );
}
