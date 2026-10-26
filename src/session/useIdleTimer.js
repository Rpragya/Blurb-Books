import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];

/** Calls `onIdle` once after `idleMs` without user activity while enabled. */
export function useIdleTimer({ enabled, idleMs, onIdle }) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => onIdleRef.current(), idleMs);
    let lastReset = Date.now();
    const reset = () => {
      // Throttle: scroll and pointer events can fire very often.
      if (Date.now() - lastReset < 500) return;
      lastReset = Date.now();
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), idleMs);
    };
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, reset, { passive: true, capture: true });
    return () => {
      clearTimeout(timer);
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, reset, { capture: true });
    };
  }, [enabled, idleMs]);
}
