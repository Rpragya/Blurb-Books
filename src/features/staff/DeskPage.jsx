import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useOnline } from '../../api/ApiContext';
import { keys, useLibraryMutation } from '../../api/queries';
import { ApiError } from '../../api/types';
import { Button } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { Spinner, errorMessage, useAnnounce } from '../../ui/Feedback';
import { Badge, CopyStatusBadge, LoanStateBadge, Notice } from '../../ui/Status';
import { BarcodeForm, DemoBarcodes, MemberPicker, StaffPageHeader, fmtDate, fmtDateTime } from './shared';

const MODES = [
  ['checkout', 'Check out'],
  ['return', 'Return'],
  ['session', 'Read in library'],
];

export function DeskPage() {
  const [params] = useSearchParams();
  const mode = (MODES.find(([m]) => m === params.get('mode'))?.[0] ?? 'checkout');
  return (
    <div className="staff-page">
      <StaffPageHeader title="Circulation desk">Scan or type barcodes. Every action is re-validated by the server before it’s confirmed.</StaffPageHeader>
      <nav className="segmented segmented--tabs" aria-label="Desk mode">
        {MODES.map(([m, label]) => (
          <Link key={m} to={`?mode=${m}`} aria-current={m === mode ? 'page' : undefined} replace>
            {label}
          </Link>
        ))}
      </nav>
      {/* key: each mode starts clean, so half-entered data can't leak between them */}
      {mode === 'checkout' && <CheckoutPanel key="checkout" />}
      {mode === 'return' && <ReturnPanel key="return" />}
      {mode === 'session' && <SessionPanel key="session" />}
    </div>
  );
}

/** Pre-select a member from ?member= (e.g. "Check out" from the pickup queue). */
function usePrefilledMember() {
  const api = useApi();
  const [params] = useSearchParams();
  const memberId = params.get('member');
  const [member, setMember] = useState(null);
  const prefill = useQuery({
    queryKey: keys.staffMember(memberId ?? ''),
    queryFn: ({ signal }) => api.getStaffMember(memberId, { signal }),
    enabled: !!memberId,
  });
  const used = useRef(false);
  useEffect(() => {
    if (prefill.data && !used.current) {
      used.current = true;
      setMember(prefill.data);
    }
  }, [prefill.data]);
  return [member, setMember];
}

// ---------------------------------------------------------------------------

function CheckoutPanel() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [member, setMember] = usePrefilledMember();
  const [barcode, setBarcode] = useState(params.get('barcode') ?? '');
  const [scanned, setScanned] = useState(params.get('barcode'));
  const [receipts, setReceipts] = useState([]);
  const barcodeRef = useRef(null);

  // Fresh preview on every scan: staleTime 0 and no cache between scans.
  const preview = useQuery({
    queryKey: keys.checkoutPreview(member?.member.id ?? '', scanned ?? ''),
    queryFn: ({ signal }) => api.previewCheckout(member.member.id, scanned, { signal }),
    enabled: !!member && !!scanned,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const checkout = useLibraryMutation(
    (a, vars, opts) => a.checkout(vars, opts),
    {
      onSuccess: (loan) => {
        const p = preview.data;
        setReceipts((r) => [{ title: p.edition.title, barcode: p.copy.barcode, detail: `Due ${fmtDate(loan.dueAt)}` }, ...r]);
        announce(`Checked out ${p.edition.title}. Due ${fmtDate(loan.dueAt)}.`);
        setBarcode('');
        setScanned(null);
        barcodeRef.current?.focus();
      },
    },
  );

  const scan = (code) => {
    checkout.reset();
    setScanned(code);
    // Re-scanning the same code must re-check, not reuse the old answer.
    void queryClient.invalidateQueries({ queryKey: keys.checkoutPreview(member?.member.id ?? '', code) });
  };

  const conflict = checkout.error instanceof ApiError && checkout.error.kind === 'conflict';

  return (
    <div className="desk-grid">
      <section className="desk-card" aria-labelledby="co-member">
        <h2 id="co-member" className="desk-card__title">
          <span className="step-n">1</span> Member
        </h2>
        <MemberPicker value={member} onChange={(m) => { setMember(m); checkout.reset(); }} autoFocus={!member} />
      </section>

      <section className="desk-card" aria-labelledby="co-copy">
        <h2 id="co-copy" className="desk-card__title">
          <span className="step-n">2</span> Copy
        </h2>
        <BarcodeForm ref={barcodeRef} value={barcode} onChange={setBarcode} onSubmit={scan} disabled={!member} autoFocus={!!member} />
        {!member && <p className="muted small">Choose the member first.</p>}
        <DemoBarcodes filter="lendable" onPick={(b) => { setBarcode(b); if (member) scan(b); }} />

        {scanned && member && (
          <div className="desk-preview" aria-live="polite">
            {preview.isFetching && !preview.data ? (
              <Spinner label="Checking copy" />
            ) : preview.isError ? (
              <Notice tone="danger" role="alert" title="Can’t check out this barcode">
                {errorMessage(preview.error)}
              </Notice>
            ) : preview.data ? (
              <>
                <div className="desk-preview__item">
                  <Cover edition={preview.data.edition} size="xs" />
                  <div>
                    <p className="desk-preview__title">{preview.data.edition.title}</p>
                    <p className="muted small">
                      <span className="barcode">{preview.data.copy.barcode}</span> · Rack {preview.data.copy.location.rackId}, shelf{' '}
                      {preview.data.copy.location.shelf}
                    </p>
                    <CopyStatusBadge status={preview.data.copy.status} policy={preview.data.copy.policy} />
                  </div>
                </div>
                {preview.data.collectsReservation && (
                  <Notice tone="accent" title="Collecting a reservation">
                    This copy is on the hold shelf for {member.member.name}. Checking it out closes the reservation.
                  </Notice>
                )}
                {preview.data.eligible ? (
                  <p className="desk-preview__due">
                    Due back <strong>{fmtDate(preview.data.dueAt)}</strong>
                  </p>
                ) : (
                  <Notice tone="danger" title="Can’t check out">
                    <ul className="reason-list">
                      {preview.data.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </Notice>
                )}
                {checkout.isError && (
                  <Notice
                    tone="danger"
                    role="alert"
                    title={conflict ? 'This copy changed' : 'Checkout failed'}
                    action={
                      conflict && (
                        <Button size="sm" icon="refresh" onClick={() => { checkout.reset(); void preview.refetch(); }}>
                          Check again
                        </Button>
                      )
                    }
                  >
                    {errorMessage(checkout.error)}
                    {!conflict && ' Nothing was recorded — you can try again.'}
                  </Notice>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  loading={checkout.isPending}
                  disabled={!preview.data.eligible || !online || conflict}
                  onClick={() =>
                    checkout.mutate({ memberId: member.member.id, copyId: preview.data.copy.id, expectedVersion: preview.data.copy.version })
                  }
                >
                  Confirm checkout
                </Button>
                {!online && <p className="muted small">Offline — checkout is disabled.</p>}
              </>
            ) : null}
          </div>
        )}
      </section>

      <Receipts receipts={receipts} title="Checked out this visit" />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReturnPanel() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [barcode, setBarcode] = useState(params.get('barcode') ?? '');
  const [scanned, setScanned] = useState(params.get('barcode'));
  const [result, setResult] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const barcodeRef = useRef(null);

  const lookup = useQuery({
    queryKey: keys.copy(scanned ?? ''),
    queryFn: ({ signal }) => api.lookupCopy(scanned, { signal }),
    enabled: !!scanned,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const done = (r) => {
    setReceipts((list) => [r, ...list]);
    setBarcode('');
    setScanned(null);
    barcodeRef.current?.focus();
  };

  const ret = useLibraryMutation((a, copyId, opts) => a.returnCopy({ copyId }, opts), {
    onSuccess: (r) => {
      setResult(r);
      announce(r.kind === 'hold' ? `Returned. Place on the hold shelf for ${r.holdFor}.` : 'Returned. Place on the reshelving trolley.');
      done({ title: r.title, barcode: r.barcode, detail: r.kind === 'hold' ? `Hold shelf for ${r.holdFor}` : 'To reshelving trolley' });
    },
  });
  const endSession = useLibraryMutation((a, id, opts) => a.endSession(id, opts), {
    onSuccess: () => {
      const l = lookup.data;
      announce('Reading session ended. Copy moved to reshelving.');
      setResult(null);
      done({ title: l.edition.title, barcode: l.copy.barcode, detail: 'Session ended · to reshelving trolley' });
    },
  });

  const scan = (code) => {
    ret.reset();
    endSession.reset();
    setResult(null);
    setScanned(code);
    void queryClient.invalidateQueries({ queryKey: keys.copy(code) });
  };

  const l = lookup.data;

  return (
    <div className="desk-grid">
      <section className="desk-card desk-card--wide" aria-labelledby="ret-copy">
        <h2 id="ret-copy" className="desk-card__title">
          Scan the returned copy
        </h2>
        <BarcodeForm ref={barcodeRef} value={barcode} onChange={setBarcode} onSubmit={scan} autoFocus />
        <DemoBarcodes filter="returnable" onPick={(b) => { setBarcode(b); scan(b); }} />

        {result && (
          <Notice tone={result.kind === 'hold' ? 'accent' : 'ok'} role="status" title={`Returned: ${result.title}`}>
            {result.kind === 'hold' ? (
              <>
                <strong>Put it on the hold shelf</strong> for {result.holdFor}. Pickup by {fmtDate(result.pickupBy)}.
              </>
            ) : (
              <>
                <strong>Put it on the reshelving trolley.</strong> It shows as available once it’s reshelved.
              </>
            )}
            {result.wasOverdueDays > 0 && <> Returned {result.wasOverdueDays} day(s) late.</>}
          </Notice>
        )}

        {scanned && (
          <div className="desk-preview" aria-live="polite">
            {lookup.isFetching && !l ? (
              <Spinner label="Looking up copy" />
            ) : lookup.isError ? (
              <Notice tone="danger" role="alert" title="Not found">
                {errorMessage(lookup.error)}
              </Notice>
            ) : l ? (
              <>
                <div className="desk-preview__item">
                  <Cover edition={l.edition} size="xs" />
                  <div>
                    <p className="desk-preview__title">{l.edition.title}</p>
                    <p className="muted small">
                      <span className="barcode">{l.copy.barcode}</span> · {l.locationText}
                    </p>
                    <CopyStatusBadge status={l.copy.status} policy={l.copy.policy} />
                  </div>
                </div>
                {l.activeLoan ? (
                  <>
                    <dl className="details-list details-list--inline">
                      <div>
                        <dt>Borrower</dt>
                        <dd>{l.activeLoan.memberName}</dd>
                      </div>
                      <div>
                        <dt>Due</dt>
                        <dd>
                          {fmtDate(l.activeLoan.loan.dueAt)} <LoanStateBadge state={l.activeLoan.state} />
                        </dd>
                      </div>
                      <div>
                        <dt>Queue</dt>
                        <dd>{l.waitingCount > 0 ? `${l.waitingCount} waiting — will go to the hold shelf` : 'Nobody waiting'}</dd>
                      </div>
                    </dl>
                    {ret.isError && (
                      <Notice tone="danger" role="alert" title="Return not recorded">
                        {errorMessage(ret.error)}
                      </Notice>
                    )}
                    <Button variant="primary" size="lg" loading={ret.isPending} disabled={!online} onClick={() => ret.mutate(l.copy.id)}>
                      Confirm return
                    </Button>
                  </>
                ) : l.activeSession ? (
                  <>
                    <Notice tone="info" title="In a reading session">
                      {l.activeSession.memberName} has been reading this since {fmtDateTime(l.activeSession.session.startedAt)}. Ending the
                      session moves the copy to reshelving.
                    </Notice>
                    {endSession.isError && <Notice tone="danger" role="alert">{errorMessage(endSession.error)}</Notice>}
                    <Button variant="primary" loading={endSession.isPending} disabled={!online} onClick={() => endSession.mutate(l.activeSession.session.id)}>
                      End reading session
                    </Button>
                  </>
                ) : (
                  <Notice tone="warn" title="No active loan for this copy">
                    It’s currently <CopyStatusBadge status={l.copy.status} />.{' '}
                    {l.copy.status === 'awaiting_reshelving' && <Link to="/staff/reshelving">Go to reshelving</Link>}
                    {l.hold && <> On hold for {l.hold.memberName}.</>}
                  </Notice>
                )}
              </>
            ) : null}
          </div>
        )}
      </section>
      <Receipts receipts={receipts} title="Returned this visit" />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SessionPanel() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const queryClient = useQueryClient();
  const [member, setMember] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [scanned, setScanned] = useState(null);
  const [started, setStarted] = useState(null);

  const lookup = useQuery({
    queryKey: keys.copy(scanned ?? ''),
    queryFn: ({ signal }) => api.lookupCopy(scanned, { signal }),
    enabled: !!scanned,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const start = useLibraryMutation(
    (a, vars, opts) => a.startSession(vars, opts),
    {
      onSuccess: () => {
        const title = lookup.data.edition.title;
        setStarted(title);
        announce(`Reading session started for ${title}.`);
        setBarcode('');
        setScanned(null);
      },
    },
  );
  const l = lookup.data;

  return (
    <div className="desk-grid">
      <section className="desk-card" aria-labelledby="rs-member">
        <h2 id="rs-member" className="desk-card__title">
          <span className="step-n">1</span> Reader
        </h2>
        <MemberPicker value={member} onChange={setMember} autoFocus />
      </section>
      <section className="desk-card" aria-labelledby="rs-copy">
        <h2 id="rs-copy" className="desk-card__title">
          <span className="step-n">2</span> Copy they’re reading
        </h2>
        <p className="muted small">
          Records that this copy is in use here so it isn’t reshelved or lent. It doesn’t track whether anyone is actually reading.
        </p>
        <BarcodeForm
          value={barcode}
          onChange={setBarcode}
          onSubmit={(code) => {
            start.reset();
            setStarted(null);
            setScanned(code);
            void queryClient.invalidateQueries({ queryKey: keys.copy(code) });
          }}
          disabled={!member}
        />
        <DemoBarcodes filter="readable" onPick={(b) => { setBarcode(b); if (member) setScanned(b); }} />
        {started && (
          <Notice tone="ok" title="Session started">
            {started} is now marked as in-library use. <Link to="/staff/sessions">See active sessions</Link>
          </Notice>
        )}
        {scanned && member && (
          <div className="desk-preview" aria-live="polite">
            {lookup.isFetching && !l ? (
              <Spinner />
            ) : lookup.isError ? (
              <Notice tone="danger" role="alert">{errorMessage(lookup.error)}</Notice>
            ) : l ? (
              <>
                <p className="desk-preview__title">{l.edition.title}</p>
                <CopyStatusBadge status={l.copy.status} policy={l.copy.policy} />
                {l.copy.status !== 'available' ? (
                  <Notice tone="warn">Only copies on the shelf can start a session.</Notice>
                ) : (
                  <>
                    {start.isError && <Notice tone="danger" role="alert">{errorMessage(start.error)}</Notice>}
                    <Button
                      variant="primary"
                      loading={start.isPending}
                      disabled={!online}
                      onClick={() => start.mutate({ memberId: member.member.id, copyId: l.copy.id, expectedVersion: l.copy.version })}
                    >
                      Start reading session
                    </Button>
                  </>
                )}
              </>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function Receipts({ receipts, title }) {
  if (receipts.length === 0) return null;
  return (
    <section className="desk-card desk-receipts" aria-labelledby="receipts-heading">
      <h2 id="receipts-heading" className="desk-card__title">
        {title}
      </h2>
      <ul role="list">
        {receipts.map((r, i) => (
          <li key={`${r.barcode}-${i}`}>
            <Badge tone="ok" icon="check">
              Done
            </Badge>{' '}
            <strong>{r.title}</strong> <span className="barcode">{r.barcode}</span> — {r.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}
