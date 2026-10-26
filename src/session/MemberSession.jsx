import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useAnnounce } from '../ui/Feedback';
import { useIdleTimer } from './useIdleTimer';

const SHORT_TIMEOUT_KEY = 'blurb-books:short-timeouts';

export const DEFAULT_TIMING = { idleMs: 90_000, warningMs: 30_000 };
export const SHORT_TIMING = { idleMs: 15_000, warningMs: 10_000 };

export function getConfiguredTiming() {
  try {
    return window.localStorage.getItem(SHORT_TIMEOUT_KEY) === '1' ? SHORT_TIMING : DEFAULT_TIMING;
  } catch {
    return DEFAULT_TIMING;
  }
}

export function setShortTimeouts(enabled) {
  try {
    if (enabled) window.localStorage.setItem(SHORT_TIMEOUT_KEY, '1');
    else window.localStorage.removeItem(SHORT_TIMEOUT_KEY);
  } catch {
    /* ignore */
  }
}

const MemberSessionContext = createContext(null);

/**
 * Personal session for a shared kiosk.
 *
 * The session is held in React memory only — never in localStorage or
 * sessionStorage — so a reload, a timeout or "End session" all leave nothing
 * behind. On end, every ['member', …] query is removed from the cache and
 * member-only routes redirect to the public welcome screen.
 */
export function MemberSessionProvider({ children, timing }) {
  const [session, setSession] = useState(null);
  const [lastEnded, setLastEnded] = useState(null);
  const [warning, setWarning] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const announce = useAnnounce();
  // Timing is fixed when a session starts, so changing the demo setting affects the next session.
  const effectiveTiming = session?.timing ?? DEFAULT_TIMING;
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const endSession = useCallback(
    (reason = 'manual') => {
      setWarning(false);
      setSession(null);
      queryClient.removeQueries({ queryKey: ['member'] });
      setLastEnded(reason);
      announce(
        reason === 'timeout'
          ? 'Your session timed out. Your details have been cleared from this screen.'
          : 'Session ended. Your details have been cleared from this screen.',
        'assertive',
      );
      if (pathRef.current.startsWith('/member')) navigate('/', { replace: true });
    },
    [queryClient, announce, navigate],
  );

  const signIn = useCallback(
    (info) => {
      setLastEnded(null);
      setSession({ ...info, startedAt: Date.now(), timing: timing ?? getConfiguredTiming() });
    },
    [timing],
  );

  useIdleTimer({
    enabled: !!session && !warning,
    idleMs: effectiveTiming.idleMs,
    onIdle: () => setWarning(true),
  });

  useEffect(() => {
    if (!lastEnded) return;
    const t = setTimeout(() => setLastEnded(null), 10_000);
    return () => clearTimeout(t);
  }, [lastEnded]);

  const value = useMemo(
    () => ({ session, signIn, endSession, lastEnded, dismissEndedNotice: () => setLastEnded(null) }),
    [session, signIn, endSession, lastEnded],
  );

  return (
    <MemberSessionContext.Provider value={value}>
      {children}
      {session && warning && (
        <TimeoutWarning
          name={session.name}
          warningMs={effectiveTiming.warningMs}
          onContinue={() => setWarning(false)}
          onEnd={endSession}
        />
      )}
    </MemberSessionContext.Provider>
  );
}

function TimeoutWarning({
  name,
  warningMs,
  onContinue,
  onEnd,
}) {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000));
  const continueRef = useRef(null);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  useEffect(() => {
    const deadline = Date.now() + warningMs;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(tick);
        onEndRef.current('timeout');
      }
    }, 250);
    return () => clearInterval(tick);
  }, [warningMs]);

  return (
    <Dialog
      role="alertdialog"
      title="Are you still there?"
      description={`To protect your privacy, ${name.split(' ')[0]}’s session will end automatically.`}
      onClose={onContinue}
      initialFocusRef={continueRef}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onEnd('manual')}>
            End session now
          </Button>
          <Button ref={continueRef} variant="primary" onClick={onContinue}>
            Continue session
          </Button>
        </>
      }
    >
      <p className="timeout-count" aria-live="off">
        <span className="timeout-count__number">{secondsLeft}</span> seconds left
      </p>
      {/* Announce only at coarse intervals so the countdown isn't noisy. */}
      <p className="visually-hidden" aria-live="polite">
        {secondsLeft === 10 ? '10 seconds left' : ''}
      </p>
    </Dialog>
  );
}

export function useMemberSession() {
  const value = useContext(MemberSessionContext);
  if (!value) throw new Error('useMemberSession must be used inside <MemberSessionProvider>');
  return value;
}
