import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

interface DialogProps {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Element to focus first; defaults to the first focusable control. */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Element to return focus to; defaults to whatever was focused on open. */
  returnFocusRef?: React.RefObject<HTMLElement>;
  variant?: 'center' | 'drawer' | 'sheet';
  size?: 'sm' | 'md' | 'lg';
  /** alertdialog for confirmations that interrupt (e.g. session timeout). */
  role?: 'dialog' | 'alertdialog';
  dismissible?: boolean;
}

/**
 * Accessible modal dialog.
 *
 * - Renders into a portal and marks the app root `inert`, so the rest of the
 *   page can't be reached by keyboard, pointer or screen reader.
 * - Traps Tab / Shift+Tab inside the panel and closes on Escape.
 * - Restores focus to the opener (or `returnFocusRef`) when it unmounts.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  initialFocusRef,
  returnFocusRef,
  variant = 'center',
  size = 'md',
  role = 'dialog',
  dismissible = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target = initialFocusRef?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
    target?.focus();

    return () => {
      root?.removeAttribute('inert');
      root?.removeAttribute('aria-hidden');
      document.body.style.overflow = previousOverflow;
      // Read at close time on purpose: the return target may render after the dialog opens.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const back = returnFocusRef?.current ?? opener;
      // Wait a frame so the opener is interactive again after `inert` is removed.
      requestAnimationFrame(() => {
        if (back && document.contains(back)) back.focus();
      });
    };
    // Focus handling should run once per open, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]'));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [dismissible]);

  return createPortal(
    <div className={`dialog-backdrop dialog-backdrop--${variant}`} onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`dialog dialog--${variant} dialog--${size}`}
      >
        <header className="dialog__header">
          <div>
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            {description && (
              <p id={descId} className="dialog__description">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          )}
        </header>
        <div className="dialog__body">{children}</div>
        {footer && <footer className="dialog__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
