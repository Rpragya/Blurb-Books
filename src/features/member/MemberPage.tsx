import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useOnline } from '../../api/ApiContext';
import { useLibraryMutation, useMemberOverview } from '../../api/queries';
import type { MemberLoanView, MemberReservationView } from '../../api/types';
import { PageHeading, usePageTitle } from '../../app/focus';
import { useMemberSession } from '../../session/MemberSession';
import { Button } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { EmptyState, ErrorState, Freshness, Spinner, errorMessage, useAnnounce } from '../../ui/Feedback';
import { Field } from '../../ui/Field';
import { Badge, LoanStateBadge, Notice } from '../../ui/Status';
import { BookCard } from '../kiosk/BookCard';

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmt = (iso: string) => dateFormat.format(new Date(iso));

export function MemberPage() {
  const { session } = useMemberSession();
  usePageTitle(session ? 'My library' : 'Sign in');
  return session ? <MemberDashboard memberId={session.memberId} /> : <SignIn />;
}

const DEMO_ACCOUNTS = [
  { card: '20010001', pin: '1234', who: 'Asha — loans, an overdue item, a hold ready' },
  { card: '20010002', pin: '2345', who: 'Tom — renewal blocked by a waiting reservation' },
  { card: '20010005', pin: '5678', who: 'Noor — new member, nothing borrowed yet' },
  { card: '20010004', pin: '4567', who: 'Rafael — borrowing paused (long overdue)' },
];

/** Only same-origin public paths are valid post-sign-in destinations. */
function safeNext(next: string | null): string {
  return next && /^\/(books|search|map|explore)(\/|\?|$)/.test(next) ? next : '/member';
}

function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useMemberSession();
  const [card, setCard] = useState('');
  const [pin, setPin] = useState('');
  const online = useOnline();
  const pinRef = useRef<HTMLInputElement>(null);
  const attempt = useLibraryMutation((api, vars: { card: string; pin: string }) => api.memberSignIn(vars.card, vars.pin), {
    onSuccess: (info) => {
      signIn(info);
      navigate(safeNext(params.get('next')), { replace: true });
    },
  });

  return (
    <div className="container member-signin">
      <div className="member-signin__panel">
        <p className="eyebrow">My library</p>
        <PageHeading>Sign in with your library card</PageHeading>
        <p className="muted">See your loans, renew books, track reservations and keep a list of books to read.</p>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            attempt.mutate({ card, pin });
          }}
          noValidate
        >
          <Field label="Card number" hint="The 8 digits under the barcode on your card">
            <input
              inputMode="numeric"
              autoComplete="off"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              required
              maxLength={12}
            />
          </Field>
          <Field label="PIN" error={attempt.isError ? errorMessage(attempt.error) : undefined}>
            <input
              ref={pinRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              maxLength={8}
            />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={attempt.isPending} disabled={!online || !card || !pin}>
            Sign in
          </Button>
          <p className="muted small">
            On a shared screen? Your session ends automatically after a short time without activity, and you can end it any time.
          </p>
        </form>
      </div>

      <aside className="demo-accounts" aria-labelledby="demo-accounts-heading">
        <h2 id="demo-accounts-heading">Demo accounts</h2>
        <p className="muted small">
          Sign-in is simulated for this demo and is not secure. A real system would verify credentials on the server.
        </p>
        <ul role="list">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.card}>
              <button
                type="button"
                className="demo-account"
                onClick={() => {
                  setCard(a.card);
                  setPin(a.pin);
                  pinRef.current?.focus();
                }}
              >
                <span className="barcode">{a.card}</span> / PIN {a.pin}
                <span className="demo-account__who">{a.who}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function MemberDashboard({ memberId }: { memberId: string }) {
  const overview = useMemberOverview(memberId);
  const { endSession } = useMemberSession();

  if (overview.isPending) {
    return (
      <div className="container member-page">
        <PageHeading className="visually-hidden">My library</PageHeading>
        <Spinner label="Loading your library" />
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="container member-page">
        <PageHeading>My library</PageHeading>
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      </div>
    );
  }

  const { member, loans, reservations, saved, borrowing } = overview.data;
  const ready = reservations.filter((r) => r.reservation.status === 'ready');
  const open = reservations.filter((r) => r.reservation.status === 'waiting');
  const closed = reservations.filter((r) => !['ready', 'waiting'].includes(r.reservation.status));
  const overdue = loans.filter((l) => l.state === 'overdue').length;

  return (
    <div className="container member-page">
      <header className="member-header">
        <div>
          <p className="eyebrow">My library</p>
          <PageHeading>Hello, {member.name.split(' ')[0]}</PageHeading>
          <p className="member-header__summary">
            {loans.length} on loan{overdue > 0 && <>, <strong>{overdue} overdue</strong></>}
            {ready.length > 0 && <> · {ready.length} ready to collect</>}
            {open.length > 0 && <> · {open.length} reserved</>}
          </p>
          <Freshness at={overview.data.asOf} fetching={overview.isFetching} />
        </div>
        <Button variant="secondary" onClick={() => endSession('manual')}>
          End session
        </Button>
      </header>

      {!borrowing.eligible && (
        <Notice tone="danger" title="Borrowing is paused on your card">
          <ul className="reason-list">
            {borrowing.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Notice>
      )}

      {ready.length > 0 && (
        <section aria-labelledby="ready-heading" className="member-section">
          <h2 id="ready-heading">Ready to collect</h2>
          <ul className="member-list" role="list">
            {ready.map((r) => (
              <ReservationItem key={r.reservation.id} view={r} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="loans-heading" className="member-section">
        <h2 id="loans-heading">On loan</h2>
        {loans.length === 0 ? (
          <EmptyState title="Nothing on loan">
            Find something to borrow in <Link to="/explore">Browse</Link>.
          </EmptyState>
        ) : (
          <ul className="member-list" role="list">
            {loans.map((l) => (
              <LoanItem key={l.loan.id} view={l} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="res-heading" className="member-section">
        <h2 id="res-heading">Reservations</h2>
        {open.length === 0 && closed.length === 0 ? (
          <p className="muted">No reservations. When every copy of a book is out, you can reserve it from its page.</p>
        ) : (
          <ul className="member-list" role="list">
            {[...open, ...closed].map((r) => (
              <ReservationItem key={r.reservation.id} view={r} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="saved-heading" className="member-section">
        <h2 id="saved-heading">Saved for later</h2>
        {saved.length === 0 ? (
          <p className="muted">Tap “Save” on any book to keep it here.</p>
        ) : (
          <ul className="similar-grid" role="list">
            {saved.map((s) => (
              <li key={s.edition.id}>
                <BookCard book={s} layout="compact" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LoanItem({ view }: { view: MemberLoanView }) {
  const online = useOnline();
  const announce = useAnnounce();
  const renew = useLibraryMutation((api, loanId: string, opts) => api.renewLoan(loanId, opts), {
    onSuccess: (loan) => announce(`Renewed. Now due ${fmt(loan.dueAt)}.`),
  });
  const reasonsId = `renew-reasons-${view.loan.id}`;

  return (
    <li className="member-item">
      <Cover edition={view.edition} size="xs" />
      <div className="member-item__body">
        <h3 className="member-item__title">
          <Link to={`/books/${view.edition.id}`}>{view.edition.title}</Link>
        </h3>
        <p className="member-item__meta">
          Due <strong>{fmt(view.loan.dueAt)}</strong> · renewed {view.loan.renewals} of 2 times
        </p>
        <LoanStateBadge state={view.state} daysOverdue={view.daysOverdue} />
        {renew.isSuccess && <p className="member-item__ok">Renewed — now due {fmt(renew.data.dueAt)}.</p>}
        {renew.isError && (
          <p className="member-item__error" role="alert">
            {errorMessage(renew.error)}
          </p>
        )}
        {!view.renewal.eligible && (
          <ul id={reasonsId} className="reason-list reason-list--small">
            {view.renewal.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="member-item__action">
        <Button
          size="sm"
          loading={renew.isPending}
          disabled={!view.renewal.eligible || !online}
          aria-describedby={!view.renewal.eligible ? reasonsId : undefined}
          onClick={() => renew.mutate(view.loan.id)}
        >
          {view.renewal.eligible ? `Renew to ${fmt(view.renewal.newDueAt)}` : 'Can’t renew'}
        </Button>
      </div>
    </li>
  );
}

function ReservationItem({ view }: { view: MemberReservationView }) {
  const online = useOnline();
  const announce = useAnnounce();
  const cancel = useLibraryMutation((api, id: string, opts) => api.cancelReservation(id, opts), {
    onSuccess: () => announce('Reservation cancelled.'),
  });
  const { reservation: r } = view;
  const status =
    r.status === 'ready' ? (
      <Badge tone="ok" icon="check">
        Ready · collect by {fmt(r.pickupBy!)}
      </Badge>
    ) : r.status === 'waiting' ? (
      <Badge tone="accent" icon="clock">
        {view.position === 1 ? 'Next in line' : `Number ${view.position} in the queue`}
      </Badge>
    ) : (
      <Badge tone="neutral">{{ collected: 'Collected', cancelled: 'Cancelled', expired: 'Pickup window ended' }[r.status as 'collected']}</Badge>
    );

  return (
    <li className="member-item">
      <Cover edition={view.edition} size="xs" />
      <div className="member-item__body">
        <h3 className="member-item__title">
          <Link to={`/books/${view.edition.id}`}>{view.edition.title}</Link>
        </h3>
        {status}
        {view.pickupLocation && <p className="member-item__meta">{view.pickupLocation}. Bring your library card.</p>}
        {cancel.isError && (
          <p className="member-item__error" role="alert">
            {errorMessage(cancel.error)}
          </p>
        )}
      </div>
      {(r.status === 'waiting' || r.status === 'ready') && (
        <div className="member-item__action">
          <Button size="sm" variant="ghost" loading={cancel.isPending} disabled={!online} onClick={() => cancel.mutate(r.id)}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}
