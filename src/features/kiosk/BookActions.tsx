import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useOnline } from '../../api/ApiContext';
import { useLibraryMutation, useMemberOverview, useReservationEligibility } from '../../api/queries';
import type { BookDetail } from '../../api/types';
import { POLICY } from '../../domain/policy';
import { useMemberSession } from '../../session/MemberSession';
import { Button, ButtonLink } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { errorMessage, useAnnounce } from '../../ui/Feedback';
import { Notice } from '../../ui/Status';

export function SaveButton({ editionId }: { editionId: string }) {
  const { session } = useMemberSession();
  const online = useOnline();
  const overview = useMemberOverview(session?.memberId);
  const announce = useAnnounce();
  const toggle = useLibraryMutation((api, _: void, _opts) => api.toggleSaved(session!.memberId, editionId), {
    onSuccess: ({ saved }) => announce(saved ? 'Saved to your list' : 'Removed from your list'),
  });

  if (!session) {
    return (
      <ButtonLink to={`/member?next=/books/${editionId}`} icon="bookmark" variant="primary" size="lg">
        Sign in to save
      </ButtonLink>
    );
  }
  const saved = overview.data?.member.savedEditionIds.includes(editionId) ?? false;
  return (
    <Button
      icon={saved ? 'bookmarkFilled' : 'bookmark'}
      variant={saved ? 'secondary' : 'primary'}
      size="lg"
      aria-pressed={saved}
      loading={toggle.isPending || overview.isPending}
      disabled={!online}
      onClick={() => toggle.mutate()}
    >
      {saved ? 'On my bookshelf' : 'Save to my bookshelf'}
    </Button>
  );
}

/**
 * Edition-level reservation. Only offered when no lendable copy is on the
 * shelf; eligibility comes from the server so the UI never guesses.
 */
export function ReserveAction({ book }: { book: BookDetail }) {
  const { edition, availability } = book;
  const { session } = useMemberSession();
  const online = useOnline();
  const eligibility = useReservationEligibility(session?.memberId, edition.id);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const announce = useAnnounce();
  const reserve = useLibraryMutation((api, _: void, opts) => api.reserve(session!.memberId, edition.id, opts), {
    onSuccess: ({ position }) => {
      setConfirming(false);
      setResult(position);
      announce(`Reserved. You are number ${position} in the queue.`);
    },
  });

  const lendable = book.copies.some((c) => c.policy === 'lendable');
  if (!lendable || availability.lendableOnShelf > 0) return null;

  if (result !== null) {
    return (
      <Notice tone="ok" title={`Reserved — you’re number ${result} in the queue`}>
        We’ll hold the next returned copy for you for {POLICY.pickupDays} days. Track it in <Link to="/member">My library</Link>.
      </Notice>
    );
  }

  if (!session) {
    return (
      <div className="reserve-cta">
        <p>All borrowable copies are out. Reserve it and we’ll hold the next one for you.</p>
        <ButtonLink to={`/member?next=/books/${edition.id}`} variant="primary" icon="user">
          Sign in to reserve
        </ButtonLink>
      </div>
    );
  }

  if (eligibility.isPending) return <Button loading>Checking reservation…</Button>;
  if (eligibility.isError) return <Notice tone="warn" title="Couldn’t check reservations">{errorMessage(eligibility.error)}</Notice>;
  if (!eligibility.data.eligible) {
    return (
      <Notice tone="info" title="Reservation not available">
        <ul className="reason-list">
          {eligibility.data.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Notice>
    );
  }

  const position = eligibility.data.queueLength + 1;
  return (
    <>
      <div className="reserve-cta">
        <p>
          {book.queueLength === 0 ? 'No one is waiting.' : `${book.queueLength} ${book.queueLength === 1 ? 'person is' : 'people are'} waiting.`}{' '}
          Reserve to join the queue.
        </p>
        <Button variant="primary" icon="bookmark" onClick={() => setConfirming(true)} disabled={!online}>
          Reserve this book
        </Button>
      </div>
      {confirming && (
        <Dialog
          title={`Reserve “${edition.title}”?`}
          onClose={() => !reserve.isPending && setConfirming(false)}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={reserve.isPending}>
                Cancel
              </Button>
              <Button variant="primary" loading={reserve.isPending} disabled={!online} onClick={() => reserve.mutate()}>
                Confirm reservation
              </Button>
            </>
          }
        >
          <ul className="confirm-list">
            <li>
              You’ll be <strong>number {position}</strong> in the queue for any copy of this edition.
            </li>
            <li>When a copy comes back, it’s held for you on the hold shelf by the help desk for {POLICY.pickupDays} days.</li>
            <li>You can cancel any time from My library.</li>
          </ul>
          <p className="muted">Demo: pickup notices are simulated — nothing is emailed.</p>
          {reserve.isError && (
            <Notice tone="danger" role="alert" title="Reservation not placed">
              {errorMessage(reserve.error)}
            </Notice>
          )}
        </Dialog>
      )}
    </>
  );
}
