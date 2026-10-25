import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../api/types';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function EmptyState({
  icon = 'book',
  title,
  children,
  actions,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Icon name={icon} size={28} />
      </span>
      <h2 className="empty-state__title">{title}</h2>
      {children && <div className="empty-state__body">{children}</div>}
      {actions && <div className="empty-state__actions">{actions}</div>}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

export function ErrorState({ error, onRetry, title = 'We couldn’t load this' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const offline = error instanceof ApiError && error.kind === 'offline';
  return (
    <div className="empty-state empty-state--error" role="alert">
      <span className="empty-state__icon">
        <Icon name={offline ? 'wifiOff' : 'alert'} size={28} />
      </span>
      <h2 className="empty-state__title">{offline ? 'You’re offline' : title}</h2>
      <p className="empty-state__body">{errorMessage(error)}</p>
      {onRetry && (
        <div className="empty-state__actions">
          <Button icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

/** "Availability as of 14:05" — shown wherever stale data could mislead. */
export function Freshness({ at, label = 'Updated', fetching }: { at?: string | number; label?: string; fetching?: boolean }) {
  if (!at) return null;
  return (
    <span className="freshness">
      <Icon name="clock" size={14} />
      {label} {timeFormat.format(new Date(at))}
      {fetching && <span className="freshness__refreshing"> · refreshing…</span>}
    </span>
  );
}

// --- Screen-reader announcements -------------------------------------------

const AnnouncerContext = createContext<(message: string, politeness?: 'polite' | 'assertive') => void>(() => {});

/**
 * Two persistent live regions. Messages are cleared and re-set so repeating
 * the same text (e.g. "12 results") is still announced.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const set = politeness === 'assertive' ? setAssertive : setPolite;
    set('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => set(message), 60);
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="announcer-polite">
        {polite}
      </div>
      <div className="visually-hidden" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce() {
  return useContext(AnnouncerContext);
}

/** Announce a message whenever `message` changes to a non-empty value. */
export function useAnnounceOnChange(message: string | undefined) {
  const announce = useAnnounce();
  useEffect(() => {
    if (message) announce(message);
  }, [message, announce]);
}
