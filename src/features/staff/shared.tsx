import { useQuery } from '@tanstack/react-query';
import { forwardRef, useDeferredValue, useState } from 'react';
import { useApi } from '../../api/ApiContext';
import { keys } from '../../api/queries';
import { usePageTitle } from '../../app/focus';
import type { StaffMemberView } from '../../api/types';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Feedback';
import { Badge } from '../../ui/Status';

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso?: string) => (iso ? dateFormat.format(new Date(iso)) : '—');
export const fmtDateTime = (iso?: string) => (iso ? dateTimeFormat.format(new Date(iso)) : '—');

export function StaffPageHeader({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  usePageTitle(`${title} · Staff`);
  return (
    <header className="staff-page-header">
      <div>
        <h1 tabIndex={-1} data-page-heading>
          {title}
        </h1>
        {children && <div className="staff-page-header__sub">{children}</div>}
      </div>
      {actions && <div className="staff-page-header__actions">{actions}</div>}
    </header>
  );
}

/** Find a member by card number or name. Keyboard-first: type, arrow, Enter. */
export function MemberPicker({
  value,
  onChange,
  autoFocus,
}: {
  value: StaffMemberView | null;
  onChange: (member: StaffMemberView | null) => void;
  autoFocus?: boolean;
}) {
  const api = useApi();
  const [q, setQ] = useState('');
  const deferred = useDeferredValue(q.trim());
  // Clear the search once someone is chosen so "Change member" starts fresh.
  const choose = (member: StaffMemberView) => {
    setQ('');
    onChange(member);
  };
  const results = useQuery({
    queryKey: keys.memberSearch(deferred),
    queryFn: ({ signal }) => api.findMembers(deferred, { signal }),
    enabled: deferred.length >= 2,
  });

  if (value) {
    return (
      <div className="picked-member">
        <div>
          <p className="picked-member__name">{value.member.name}</p>
          <p className="muted small">
            Card <span className="barcode">{value.member.cardNumber}</span> · {value.activeLoans} on loan
            {value.overdueLoans > 0 && `, ${value.overdueLoans} overdue`}
          </p>
          {value.borrowing.eligible ? (
            <Badge tone="ok" icon="check">
              Can borrow
            </Badge>
          ) : (
            <>
              <Badge tone="danger" icon="alert">
                Borrowing blocked
              </Badge>
              <ul className="reason-list reason-list--small">
                {value.borrowing.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Change member
        </Button>
      </div>
    );
  }

  return (
    <div className="member-picker">
      <label htmlFor="member-q" className="field__label">
        Find a member
      </label>
      <p className="field__hint" id="member-q-hint">
        Scan the library card, or type a card number or name (try “2001” or “Noor”).
      </p>
      <input
        id="member-q"
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-describedby="member-q-hint"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (results.data?.length === 1) choose(results.data[0]!);
          }
        }}
      />
      {deferred.length >= 2 && (
        <div className="member-picker__results" aria-live="polite">
          {results.isFetching && !results.data ? (
            <Spinner label="Searching members" />
          ) : results.data?.length === 0 ? (
            <p className="muted small">No member matches “{deferred}”.</p>
          ) : (
            <ul role="list">
              {results.data?.map((m) => (
                <li key={m.member.id}>
                  <button type="button" className="member-option" onClick={() => choose(m)}>
                    <span>{m.member.name}</span>
                    <span className="barcode">{m.member.cardNumber}</span>
                    {!m.borrowing.eligible && (
                      <Badge tone="danger" icon="alert">
                        Blocked
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Barcode entry. Handheld scanners type the code and press Enter, so this is
 * a plain form; keeping focus here makes back-to-back scanning fast.
 */
export const BarcodeForm = forwardRef<
  HTMLInputElement,
  { label?: string; value: string; onChange: (v: string) => void; onSubmit: (barcode: string) => void; disabled?: boolean; autoFocus?: boolean }
>(function BarcodeForm({ label = 'Copy barcode', value, onChange, onSubmit, disabled, autoFocus }, ref) {
  return (
    <form
      className="barcode-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim().toUpperCase());
      }}
    >
      <label htmlFor="barcode" className="field__label">
        {label}
      </label>
      <div className="barcode-form__row">
        <input
          ref={ref}
          id="barcode"
          className="input input--mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="BB000101"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          Look up
        </Button>
      </div>
    </form>
  );
});

/** Demo helper listing barcodes in interesting states. Clearly labelled. */
export function DemoBarcodes({ onPick, filter }: { onPick: (barcode: string) => void; filter: 'lendable' | 'returnable' | 'readable' }) {
  const api = useApi();
  const catalogue = useQuery({ queryKey: keys.catalogue(''), queryFn: ({ signal }) => api.listCatalogue('', { signal }) });
  const copies = (catalogue.data ?? []).flatMap((row) => row.copies);
  const picks = copies
    .filter((c) =>
      filter === 'lendable'
        ? (c.copy.status === 'available' && c.copy.policy === 'lendable') || c.copy.status === 'on_hold_shelf'
        : filter === 'returnable'
          ? c.copy.status === 'on_loan' || c.copy.status === 'in_library_use'
          : c.copy.status === 'available',
    )
    .slice(0, 8);
  return (
    <details className="demo-helper">
      <summary>Demo: sample barcodes</summary>
      {catalogue.isPending ? (
        <Spinner />
      ) : (
        <ul role="list">
          {picks.map((c) => (
            <li key={c.copy.id}>
              <button type="button" className="link-button" onClick={() => onPick(c.copy.barcode)}>
                <span className="barcode">{c.copy.barcode}</span>
              </button>{' '}
              <span className="muted small">
                {c.title} · {c.copy.status.replace(/_/g, ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
