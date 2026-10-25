/**
 * Circulation rules as pure functions over a LibraryState draft.
 *
 * The mock API runs every mutation inside a transaction: it clones the state,
 * calls one of these functions on the clone and commits only if nothing threw.
 * A production backend must enforce the same rules server-side (inside a
 * database transaction with row-level locking on the copy); the frontend uses
 * the read-only helpers here for previews and eligibility hints only.
 */
import { POLICY, DAY_MS, HOUR_MS, addDays, endOfDay } from './policy';
import type {
  BookCopy,
  BookEdition,
  CirculationEvent,
  CopyReport,
  CopyReportKind,
  CopyStatus,
  LibraryState,
  Loan,
  LoanPolicy,
  Member,
  ReadingSession,
  Reservation,
  ShelfLocation,
} from './types';

export type DomainErrorCode =
  | 'not_found'
  | 'copy_unavailable'
  | 'member_ineligible'
  | 'version_conflict'
  | 'renewal_blocked'
  | 'reservation_not_allowed'
  | 'invalid_transition';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

// ---------------------------------------------------------------------------
// Lookups

export function getMember(state: LibraryState, memberId: string): Member {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) throw new DomainError('not_found', 'No member with that id.');
  return member;
}

export function getCopy(state: LibraryState, copyId: string): BookCopy {
  const copy = state.copies.find((c) => c.id === copyId);
  if (!copy) throw new DomainError('not_found', 'No copy with that id.');
  return copy;
}

export function findCopyByBarcode(state: LibraryState, barcode: string): BookCopy | undefined {
  const normalised = barcode.trim().toUpperCase();
  return state.copies.find((c) => c.barcode === normalised);
}

export function getEdition(state: LibraryState, editionId: string): BookEdition {
  const edition = state.editions.find((e) => e.id === editionId);
  if (!edition) throw new DomainError('not_found', 'No book with that id.');
  return edition;
}

export function activeLoanForCopy(state: LibraryState, copyId: string): Loan | undefined {
  return state.loans.find((l) => l.copyId === copyId && !l.returnedAt);
}

export function activeLoansForMember(state: LibraryState, memberId: string): Loan[] {
  return state.loans.filter((l) => l.memberId === memberId && !l.returnedAt);
}

export function activeSessionForCopy(state: LibraryState, copyId: string): ReadingSession | undefined {
  return state.sessions.find((s) => s.copyId === copyId && !s.endedAt);
}

/** Waiting reservations for an edition in stable queue order. */
export function waitingQueue(state: LibraryState, editionId: string): Reservation[] {
  return state.reservations
    .filter((r) => r.editionId === editionId && r.status === 'waiting')
    .sort((a, b) => a.sequence - b.sequence);
}

export function queuePosition(state: LibraryState, reservation: Reservation): number | undefined {
  if (reservation.status !== 'waiting') return undefined;
  return waitingQueue(state, reservation.editionId).findIndex((r) => r.id === reservation.id) + 1;
}

// ---------------------------------------------------------------------------
// Derived statuses

export type LoanState = 'returned' | 'overdue' | 'due_soon' | 'on_loan';

export function loanState(loan: Pick<Loan, 'dueAt' | 'returnedAt'>, now: Date): LoanState {
  if (loan.returnedAt) return 'returned';
  const due = new Date(loan.dueAt).getTime();
  if (due < now.getTime()) return 'overdue';
  if (due - now.getTime() <= POLICY.dueSoonDays * DAY_MS) return 'due_soon';
  return 'on_loan';
}

export function daysOverdue(loan: Pick<Loan, 'dueAt' | 'returnedAt'>, now: Date): number {
  if (loan.returnedAt) return 0;
  const diff = now.getTime() - new Date(loan.dueAt).getTime();
  return diff > 0 ? Math.ceil(diff / DAY_MS) : 0;
}

export function isLongSession(session: ReadingSession, now: Date): boolean {
  return !session.endedAt && now.getTime() - new Date(session.startedAt).getTime() > POLICY.longReadingSessionHours * HOUR_MS;
}

// ---------------------------------------------------------------------------
// Eligibility (read-only — safe to call from the UI for previews)

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
}

export function memberBorrowingEligibility(state: LibraryState, memberId: string, now: Date): Eligibility {
  const member = getMember(state, memberId);
  const reasons: string[] = [];
  if (member.standing !== 'good') reasons.push('Membership is suspended — please speak to staff.');
  const loans = activeLoansForMember(state, memberId);
  if (loans.length >= POLICY.maxActiveLoans) {
    reasons.push(`Already has ${loans.length} items on loan (limit ${POLICY.maxActiveLoans}).`);
  }
  const badOverdue = loans.filter((l) => daysOverdue(l, now) > POLICY.blockingOverdueDays);
  if (badOverdue.length > 0) {
    reasons.push(`${badOverdue.length} item(s) overdue by more than ${POLICY.blockingOverdueDays} days.`);
  }
  return { eligible: reasons.length === 0, reasons };
}

export interface CheckoutPreview extends Eligibility {
  copy: BookCopy;
  edition: BookEdition;
  dueAt: string;
  /** True when this checkout collects the member's own reservation. */
  collectsReservation?: Reservation;
}

export function previewCheckout(state: LibraryState, memberId: string, copyId: string, now: Date): CheckoutPreview {
  const copy = getCopy(state, copyId);
  const edition = getEdition(state, copy.editionId);
  const { reasons } = memberBorrowingEligibility(state, memberId, now);
  let collectsReservation: Reservation | undefined;

  if (copy.policy === 'reference') {
    reasons.push('This copy is for in-library use only.');
  } else if (copy.status === 'on_hold_shelf') {
    const hold = state.reservations.find((r) => r.id === copy.heldForReservationId);
    if (hold && hold.memberId === memberId && hold.status === 'ready') collectsReservation = hold;
    else reasons.push('This copy is on the hold shelf for another member.');
  } else if (copy.status !== 'available') {
    reasons.push(copyUnavailableReason(copy.status));
  }
  if (activeLoanForCopy(state, copy.id)) {
    // Guard the core invariant explicitly even if a status got out of sync.
    reasons.push('This copy already has an active loan.');
  }
  return {
    eligible: reasons.length === 0,
    reasons: dedupe(reasons),
    copy,
    edition,
    dueAt: endOfDay(addDays(now.toISOString(), POLICY.loanDays)),
    collectsReservation,
  };
}

export function copyUnavailableReason(status: CopyStatus): string {
  switch (status) {
    case 'on_loan':
      return 'This copy is already on loan — it must be returned first.';
    case 'in_library_use':
      return 'This copy is in an active reading session — end the session first.';
    case 'awaiting_reshelving':
      return 'This copy is awaiting reshelving — reshelve it before lending.';
    case 'on_hold_shelf':
      return 'This copy is reserved for another member.';
    case 'missing':
      return 'This copy is recorded as missing.';
    case 'in_repair':
      return 'This copy is in repair.';
    case 'available':
      return '';
  }
}

export interface RenewalEligibility extends Eligibility {
  newDueAt: string;
}

export function renewalEligibility(state: LibraryState, loanId: string, now: Date): RenewalEligibility {
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) throw new DomainError('not_found', 'No loan with that id.');
  const reasons: string[] = [];
  const copy = getCopy(state, loan.copyId);
  const member = getMember(state, loan.memberId);
  if (loan.returnedAt) reasons.push('This loan has already been returned.');
  if (member.standing !== 'good') reasons.push('Membership is suspended.');
  if (loan.renewals >= POLICY.maxRenewals) {
    reasons.push(`Already renewed ${loan.renewals} times (limit ${POLICY.maxRenewals}).`);
  }
  if (loanState(loan, now) === 'overdue') reasons.push('Overdue items can only be renewed at the desk.');
  const queue = waitingQueue(state, copy.editionId).filter((r) => r.memberId !== loan.memberId);
  if (queue.length > 0) {
    reasons.push(`${queue.length === 1 ? 'Another member is' : `${queue.length} members are`} waiting for this book.`);
  }
  const base = Math.max(now.getTime(), new Date(loan.dueAt).getTime());
  return {
    eligible: reasons.length === 0,
    reasons,
    newDueAt: endOfDay(new Date(base + POLICY.loanDays * DAY_MS).toISOString()),
  };
}

export function reservationEligibility(state: LibraryState, memberId: string, editionId: string): Eligibility {
  const member = getMember(state, memberId);
  getEdition(state, editionId);
  const reasons: string[] = [];
  if (member.standing !== 'good') reasons.push('Membership is suspended.');
  const copies = state.copies.filter((c) => c.editionId === editionId);
  const lendable = copies.filter((c) => c.policy === 'lendable');
  if (lendable.length === 0) reasons.push('This book is for in-library use only and cannot be reserved.');
  else if (lendable.some((c) => c.status === 'available')) {
    reasons.push('A copy is on the shelf now — no reservation needed.');
  }
  const existing = state.reservations.find(
    (r) => r.memberId === memberId && r.editionId === editionId && (r.status === 'waiting' || r.status === 'ready'),
  );
  if (existing) reasons.push('You already have a reservation for this book.');
  const onLoan = activeLoansForMember(state, memberId).some((l) => getCopy(state, l.copyId).editionId === editionId);
  if (onLoan) reasons.push('You already have this book on loan.');
  return { eligible: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Mutations — each takes a draft state and mutates it in place.

function nextId(state: LibraryState, prefix: string): string {
  state.idCounter += 1;
  return `${prefix}-${state.idCounter}`;
}

function touch(copy: BookCopy, now: Date) {
  copy.version += 1;
  copy.updatedAt = now.toISOString();
}

function assertVersion(copy: BookCopy, expectedVersion: number | undefined) {
  if (expectedVersion !== undefined && copy.version !== expectedVersion) {
    throw new DomainError(
      'version_conflict',
      `This copy changed since it was scanned (now: ${copyStatusLabel(copy.status)}). Scan it again to see its current state.`,
    );
  }
}

export function checkout(
  state: LibraryState,
  input: { memberId: string; copyId: string; expectedVersion?: number },
  now: Date,
): Loan {
  const copy = getCopy(state, input.copyId);
  assertVersion(copy, input.expectedVersion);
  const preview = previewCheckout(state, input.memberId, input.copyId, now);
  if (!preview.eligible) {
    const memberProblem = memberBorrowingEligibility(state, input.memberId, now);
    throw new DomainError(
      memberProblem.eligible ? 'copy_unavailable' : 'member_ineligible',
      preview.reasons.join(' '),
    );
  }
  if (preview.collectsReservation) {
    preview.collectsReservation.status = 'collected';
    preview.collectsReservation.closedAt = now.toISOString();
    copy.heldForReservationId = undefined;
  }
  const loan: Loan = {
    id: nextId(state, 'loan'),
    copyId: copy.id,
    memberId: input.memberId,
    issuedAt: now.toISOString(),
    dueAt: preview.dueAt,
    renewals: 0,
  };
  state.loans.push(loan);
  copy.status = 'on_loan';
  touch(copy, now);
  return loan;
}

export type ReturnOutcome =
  | { kind: 'reshelve'; loan: Loan; copy: BookCopy }
  | { kind: 'hold'; loan: Loan; copy: BookCopy; reservation: Reservation };

export function returnCopy(state: LibraryState, copyId: string, now: Date): ReturnOutcome {
  const copy = getCopy(state, copyId);
  const loan = activeLoanForCopy(state, copyId);
  if (!loan) throw new DomainError('invalid_transition', 'This copy has no active loan to return.');
  loan.returnedAt = now.toISOString();
  const reservation = routeCopyToNextHoldOr(state, copy, 'awaiting_reshelving', now);
  return reservation ? { kind: 'hold', loan, copy, reservation } : { kind: 'reshelve', loan, copy };
}

/**
 * Assign a lendable copy to the head of its edition's queue, or put it in
 * `fallback`. Returns the reservation it was assigned to, if any.
 */
function routeCopyToNextHoldOr(
  state: LibraryState,
  copy: BookCopy,
  fallback: CopyStatus,
  now: Date,
): Reservation | undefined {
  const next = copy.policy === 'lendable' ? waitingQueue(state, copy.editionId)[0] : undefined;
  if (next) {
    next.status = 'ready';
    next.copyId = copy.id;
    next.readyAt = now.toISOString();
    next.pickupBy = endOfDay(addDays(now.toISOString(), POLICY.pickupDays));
    copy.status = 'on_hold_shelf';
    copy.heldForReservationId = next.id;
  } else {
    copy.status = fallback;
    copy.heldForReservationId = undefined;
  }
  touch(copy, now);
  return next;
}

/** A reshelved copy only becomes shelf-available if nobody is waiting for it. */
export function reshelve(state: LibraryState, copyId: string, now: Date): Reservation | undefined {
  const copy = getCopy(state, copyId);
  if (copy.status !== 'awaiting_reshelving') {
    throw new DomainError('invalid_transition', `Only copies awaiting reshelving can be reshelved (this one is ${copyStatusLabel(copy.status)}).`);
  }
  return routeCopyToNextHoldOr(state, copy, 'available', now);
}

export function renew(state: LibraryState, loanId: string, now: Date): Loan {
  const eligibility = renewalEligibility(state, loanId, now);
  if (!eligibility.eligible) throw new DomainError('renewal_blocked', eligibility.reasons.join(' '));
  const loan = state.loans.find((l) => l.id === loanId)!;
  loan.dueAt = eligibility.newDueAt;
  loan.renewals += 1;
  return loan;
}

export function startReadingSession(
  state: LibraryState,
  input: { memberId: string; copyId: string; expectedVersion?: number },
  now: Date,
): ReadingSession {
  const copy = getCopy(state, input.copyId);
  assertVersion(copy, input.expectedVersion);
  getMember(state, input.memberId);
  if (copy.status !== 'available') throw new DomainError('copy_unavailable', copyUnavailableReason(copy.status));
  const session: ReadingSession = {
    id: nextId(state, 'session'),
    copyId: copy.id,
    memberId: input.memberId,
    startedAt: now.toISOString(),
  };
  state.sessions.push(session);
  copy.status = 'in_library_use';
  touch(copy, now);
  return session;
}

export function endReadingSession(state: LibraryState, sessionId: string, now: Date): ReadingSession {
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) throw new DomainError('not_found', 'No reading session with that id.');
  if (session.endedAt) throw new DomainError('invalid_transition', 'This session has already ended.');
  session.endedAt = now.toISOString();
  const copy = getCopy(state, session.copyId);
  copy.status = 'awaiting_reshelving';
  touch(copy, now);
  return session;
}

export function reserve(state: LibraryState, memberId: string, editionId: string, now: Date): Reservation {
  const eligibility = reservationEligibility(state, memberId, editionId);
  if (!eligibility.eligible) throw new DomainError('reservation_not_allowed', eligibility.reasons.join(' '));
  const reservation: Reservation = {
    id: nextId(state, 'res'),
    editionId,
    memberId,
    sequence: state.nextSequence++,
    createdAt: now.toISOString(),
    status: 'waiting',
  };
  state.reservations.push(reservation);
  return reservation;
}

export function cancelReservation(state: LibraryState, reservationId: string, now: Date): Reservation {
  const reservation = state.reservations.find((r) => r.id === reservationId);
  if (!reservation) throw new DomainError('not_found', 'No reservation with that id.');
  if (reservation.status !== 'waiting' && reservation.status !== 'ready') {
    throw new DomainError('invalid_transition', 'Only open reservations can be cancelled.');
  }
  closeReservation(state, reservation, 'cancelled', now);
  return reservation;
}

function closeReservation(state: LibraryState, reservation: Reservation, status: 'cancelled' | 'expired', now: Date) {
  const heldCopyId = reservation.status === 'ready' ? reservation.copyId : undefined;
  reservation.status = status;
  reservation.closedAt = now.toISOString();
  if (heldCopyId) {
    // The copy passes to the next person in the queue, or goes back to the shelves.
    routeCopyToNextHoldOr(state, getCopy(state, heldCopyId), 'awaiting_reshelving', now);
  }
}

/** Expire uncollected holds whose pickup window has passed. */
export function expireOverduePickups(state: LibraryState, now: Date): Reservation[] {
  const expired = state.reservations.filter(
    (r) => r.status === 'ready' && r.pickupBy && new Date(r.pickupBy).getTime() < now.getTime(),
  );
  for (const r of expired) closeReservation(state, r, 'expired', now);
  return expired;
}

export function expireReservation(state: LibraryState, reservationId: string, now: Date): Reservation {
  const reservation = state.reservations.find((r) => r.id === reservationId);
  if (!reservation || reservation.status !== 'ready') {
    throw new DomainError('invalid_transition', 'Only reservations awaiting pickup can be expired.');
  }
  if (reservation.pickupBy && new Date(reservation.pickupBy).getTime() > now.getTime()) {
    throw new DomainError('invalid_transition', 'The pickup window has not ended yet.');
  }
  closeReservation(state, reservation, 'expired', now);
  return reservation;
}

export function toggleSaved(state: LibraryState, memberId: string, editionId: string): boolean {
  const member = getMember(state, memberId);
  getEdition(state, editionId);
  const index = member.savedEditionIds.indexOf(editionId);
  if (index >= 0) member.savedEditionIds.splice(index, 1);
  else member.savedEditionIds.unshift(editionId);
  return index < 0;
}

// ---------------------------------------------------------------------------
// Copy management and reports

const STAFF_SETTABLE: CopyStatus[] = ['available', 'missing', 'in_repair', 'awaiting_reshelving'];

export function updateCopy(
  state: LibraryState,
  input: { copyId: string; expectedVersion?: number; status?: CopyStatus; location?: ShelfLocation; policy?: LoanPolicy },
  now: Date,
): BookCopy {
  const copy = getCopy(state, input.copyId);
  assertVersion(copy, input.expectedVersion);
  if (input.status && input.status !== copy.status) {
    if (!STAFF_SETTABLE.includes(input.status) || !STAFF_SETTABLE.includes(copy.status)) {
      throw new DomainError(
        'invalid_transition',
        `Copies that are ${copyStatusLabel(copy.status)} change state through circulation (return, end session, pickup), not manual edits.`,
      );
    }
    copy.status = input.status;
  }
  if (input.location) copy.location = { ...input.location };
  if (input.policy) {
    if (input.policy === 'reference' && copy.status === 'on_loan') {
      throw new DomainError('invalid_transition', 'Return the copy before making it in-library use only.');
    }
    copy.policy = input.policy;
  }
  touch(copy, now);
  return copy;
}

export function addCopy(
  state: LibraryState,
  input: { editionId: string; location: ShelfLocation; policy: LoanPolicy },
  now: Date,
): BookCopy {
  getEdition(state, input.editionId);
  const highest = state.copies.reduce((max, c) => Math.max(max, Number(c.barcode.replace(/\D/g, '')) || 0), 0);
  const copy: BookCopy = {
    id: nextId(state, 'copy'),
    barcode: `BB${String(highest + 1).padStart(6, '0')}`,
    editionId: input.editionId,
    policy: input.policy,
    status: 'awaiting_reshelving',
    location: { ...input.location },
    version: 1,
    updatedAt: now.toISOString(),
  };
  state.copies.push(copy);
  return copy;
}

export function reportCopy(
  state: LibraryState,
  input: { copyId: string; kind: CopyReportKind; source: 'kiosk' | 'staff'; note: string },
  now: Date,
): CopyReport {
  getCopy(state, input.copyId);
  const duplicate = state.reports.find((r) => r.copyId === input.copyId && !r.resolvedAt && r.kind === input.kind);
  if (duplicate) return duplicate;
  const report: CopyReport = {
    id: nextId(state, 'report'),
    copyId: input.copyId,
    kind: input.kind,
    source: input.source,
    note: input.note.trim().slice(0, 500),
    createdAt: now.toISOString(),
  };
  state.reports.push(report);
  return report;
}

export function resolveReport(
  state: LibraryState,
  reportId: string,
  resolution: NonNullable<CopyReport['resolution']>,
  now: Date,
): CopyReport {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) throw new DomainError('not_found', 'No report with that id.');
  if (report.resolvedAt) throw new DomainError('invalid_transition', 'This report is already resolved.');
  const copy = getCopy(state, report.copyId);
  if (resolution === 'marked_missing') {
    if (copy.status !== 'available' && copy.status !== 'missing') {
      throw new DomainError('invalid_transition', `Cannot mark missing: the copy is ${copyStatusLabel(copy.status)}.`);
    }
    copy.status = 'missing';
    touch(copy, now);
  } else if (resolution === 'found' && copy.status === 'missing') {
    copy.status = 'awaiting_reshelving';
    touch(copy, now);
  }
  report.resolution = resolution;
  report.resolvedAt = now.toISOString();
  return report;
}

// ---------------------------------------------------------------------------
// Scheduled jobs (simulated)

/**
 * What a nightly/hourly job would do: expire missed pickups and queue notices.
 * Events are deduplicated by key so running twice is harmless.
 */
export function runScheduledJobs(state: LibraryState, now: Date): CirculationEvent[] {
  const created: CirculationEvent[] = [];
  const seen = new Set(state.events.map((e) => e.key));
  const emit = (event: Omit<CirculationEvent, 'id' | 'at'>) => {
    if (seen.has(event.key)) return;
    seen.add(event.key);
    const full = { ...event, id: nextId(state, 'event'), at: now.toISOString() };
    state.events.unshift(full);
    created.push(full);
  };
  const title = (copyId: string) => getEdition(state, getCopy(state, copyId).editionId).title;
  const name = (memberId: string) => getMember(state, memberId).name;

  for (const r of expireOverduePickups(state, now)) {
    emit({
      kind: 'pickup_expired',
      key: `expired:${r.id}`,
      memberId: r.memberId,
      message: `Pickup window ended for ${name(r.memberId)} — “${getEdition(state, r.editionId).title}” passed to the next reader or back to reshelving.`,
    });
  }
  for (const loan of state.loans) {
    const st = loanState(loan, now);
    if (st === 'due_soon') {
      emit({
        kind: 'due_soon_reminder',
        key: `due:${loan.id}:${loan.dueAt}`,
        memberId: loan.memberId,
        message: `Due-date reminder for ${name(loan.memberId)}: “${title(loan.copyId)}” is due ${new Date(loan.dueAt).toDateString()}.`,
      });
    } else if (st === 'overdue') {
      emit({
        kind: 'overdue_notice',
        key: `overdue:${loan.id}:${loan.dueAt}`,
        memberId: loan.memberId,
        message: `Overdue notice for ${name(loan.memberId)}: “${title(loan.copyId)}” is ${daysOverdue(loan, now)} day(s) overdue.`,
      });
    }
  }
  for (const r of state.reservations) {
    if (r.status === 'ready') {
      emit({
        kind: 'reservation_ready',
        key: `ready:${r.id}`,
        memberId: r.memberId,
        message: `Ready for pickup: “${getEdition(state, r.editionId).title}” for ${name(r.memberId)}, until ${new Date(r.pickupBy!).toDateString()}.`,
      });
    }
  }
  for (const s of state.sessions) {
    if (isLongSession(s, now)) {
      emit({
        kind: 'long_reading_session',
        key: `long:${s.id}`,
        memberId: s.memberId,
        message: `Staff flag: reading session for “${title(s.copyId)}” has been open more than ${POLICY.longReadingSessionHours} hours — check whether it was returned.`,
      });
    }
  }
  return created;
}

// ---------------------------------------------------------------------------

export function copyStatusLabel(status: CopyStatus): string {
  return {
    available: 'on the shelf',
    on_loan: 'on loan',
    in_library_use: 'in a reading session',
    awaiting_reshelving: 'awaiting reshelving',
    on_hold_shelf: 'on the hold shelf',
    missing: 'missing',
    in_repair: 'in repair',
  }[status];
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
