import { describe, expect, it } from 'vitest';
import { createSeedState } from '../api/mock/seed';
import * as rules from './circulation';
import { findInvariantViolations } from './invariants';
import { DAY_MS } from './policy';

const NOW = new Date('2026-03-10T10:00:00Z');
const later = (days) => new Date(NOW.getTime() + days * DAY_MS);

function fresh() {
  return createSeedState(NOW);
}

describe('seed data', () => {
  it('is internally consistent', () => {
    expect(findInvariantViolations(fresh())).toEqual([]);
  });

  it('has 30–40 editions and some multi-copy editions', () => {
    const state = fresh();
    expect(state.editions.length).toBeGreaterThanOrEqual(30);
    expect(state.editions.length).toBeLessThanOrEqual(40);
    const multi = state.editions.filter((e) => state.copies.filter((c) => c.editionId === e.id).length > 1);
    expect(multi.length).toBeGreaterThan(5);
  });
});

describe('checkout', () => {
  it('lends an available copy and sets a due date', () => {
    const state = fresh();
    const loan = rules.checkout(state, { memberId: 'm-noor', copyId: 'mapleford-1' }, NOW);
    expect(rules.getCopy(state, 'mapleford-1').status).toBe('on_loan');
    expect(new Date(loan.dueAt).getTime()).toBeGreaterThan(later(13).getTime());
    expect(findInvariantViolations(state)).toEqual([]);
  });

  it('never allows two active checkouts of one copy', () => {
    const state = fresh();
    rules.checkout(state, { memberId: 'm-noor', copyId: 'mapleford-1' }, NOW);
    expect(() => rules.checkout(state, { memberId: 'm-tom', copyId: 'mapleford-1' }, NOW)).toThrow(/already on loan/);
    expect(state.loans.filter((l) => l.copyId === 'mapleford-1' && !l.returnedAt)).toHaveLength(1);
  });

  it('rejects a stale scan with a version conflict', () => {
    const state = fresh();
    const { version } = rules.getCopy(state, 'mapleford-1');
    rules.checkout(state, { memberId: 'm-noor', copyId: 'mapleford-1', expectedVersion: version }, NOW);
    expect(() =>
      rules.checkout(state, { memberId: 'm-tom', copyId: 'mapleford-1', expectedVersion: version }, NOW),
    ).toThrowError(expect.objectContaining({ code: 'version_conflict' }));
  });

  it('refuses reference copies and ineligible members', () => {
    const state = fresh();
    expect(rules.previewCheckout(state, 'm-noor', 'pride-3', NOW).reasons.join()).toMatch(/in-library use only/);
    // Rafael has an item more than 14 days overdue.
    expect(rules.memberBorrowingEligibility(state, 'm-rafa', NOW).eligible).toBe(false);
    expect(rules.memberBorrowingEligibility(state, 'm-ellie', NOW).eligible).toBe(false);
  });

  it('refuses a copy awaiting reshelving until it is reshelved', () => {
    const state = fresh();
    expect(() => rules.checkout(state, { memberId: 'm-noor', copyId: 'moonstone-1' }, NOW)).toThrow(/reshelving/);
    rules.reshelve(state, 'moonstone-1', NOW);
    expect(rules.getCopy(state, 'moonstone-1').status).toBe('available');
    rules.checkout(state, { memberId: 'm-noor', copyId: 'moonstone-1' }, NOW);
  });
});

describe('return and reservations (definition-of-done story)', () => {
  it('borrow → reserve → return assigns the hold → collect', () => {
    const state = fresh();
    // Visitor (Noor) borrows the last shelf copy of the mystery.
    rules.checkout(state, { memberId: 'm-noor', copyId: 'mapleford-1' }, NOW);
    // Tom can now reserve because no copy is on the shelf.
    expect(rules.reservationEligibility(state, 'm-tom', 'mapleford').eligible).toBe(true);
    const res = rules.reserve(state, 'm-tom', 'mapleford', NOW);
    expect(rules.queuePosition(state, res)).toBe(1);

    // Reservation blocks Asha's renewal of her copy.
    const ashaLoan = state.loans.find((l) => l.copyId === 'mapleford-2' && !l.returnedAt);
    expect(rules.renewalEligibility(state, ashaLoan.id, NOW).eligible).toBe(false);

    // Return goes straight to the hold shelf, not reshelving.
    const outcome = rules.returnCopy(state, 'mapleford-1', later(1));
    expect(outcome.kind).toBe('hold');
    expect(rules.getCopy(state, 'mapleford-1').status).toBe('on_hold_shelf');
    expect(res.status).toBe('ready');
    expect(res.pickupBy).toBeDefined();

    // Nobody else can borrow the held copy; Tom can.
    expect(rules.previewCheckout(state, 'm-noor', 'mapleford-1', later(1)).eligible).toBe(false);
    rules.checkout(state, { memberId: 'm-tom', copyId: 'mapleford-1' }, later(1));
    expect(res.status).toBe('collected');
    expect(rules.getCopy(state, 'mapleford-1').status).toBe('on_loan');
    expect(findInvariantViolations(state)).toEqual([]);
  });

  it('expired pickup passes the copy to the next reader, then to reshelving', () => {
    const state = fresh();
    // Seed: Lin's Oz hold expired yesterday; Tom is next.
    const expired = rules.expireOverduePickups(state, NOW);
    expect(expired.map((r) => r.id)).toEqual(['res-seed-1']);
    const tomRes = state.reservations.find((r) => r.id === 'res-seed-2');
    expect(tomRes.status).toBe('ready');
    expect(rules.getCopy(state, 'oz-1').heldForReservationId).toBe(tomRes.id);

    // Tom misses his window too: nobody is left, so the copy goes to reshelving.
    rules.expireOverduePickups(state, later(5));
    expect(tomRes.status).toBe('expired');
    expect(rules.getCopy(state, 'oz-1').status).toBe('awaiting_reshelving');
    expect(findInvariantViolations(state)).toEqual([]);
  });

  it('keeps queue order stable by sequence', () => {
    const state = fresh();
    const a = rules.reserve(state, 'm-noor', 'dracula', NOW);
    const queue = rules.waitingQueue(state, 'dracula');
    expect(queue.map((r) => r.memberId)).toEqual(['m-asha', 'm-noor']);
    expect(rules.queuePosition(state, a)).toBe(2);
  });

  it('cancelling a ready hold releases the copy', () => {
    const state = fresh();
    rules.cancelReservation(state, 'res-seed-3', NOW);
    expect(rules.getCopy(state, 'alice-2').status).toBe('awaiting_reshelving');
  });

  it('prevents reserving when a copy is on the shelf', () => {
    const state = fresh();
    expect(rules.reservationEligibility(state, 'm-noor', 'pride').reasons.join()).toMatch(/on the shelf/);
  });
});

describe('renewal', () => {
  it('extends the due date when eligible', () => {
    const state = fresh();
    const loan = state.loans.find((l) => l.copyId === 'little-women-1');
    const before = loan.dueAt;
    rules.renew(state, loan.id, NOW);
    expect(loan.renewals).toBe(1);
    expect(loan.dueAt > before).toBe(true);
  });

  it('is blocked by the renewal limit, overdue status and waiting reservations', () => {
    const state = fresh();
    const reason = (copyId) =>
      rules.renewalEligibility(state, state.loans.find((l) => l.copyId === copyId && !l.returnedAt).id, NOW).reasons.join(' ');
    expect(reason('anna-karenina-1')).toMatch(/limit 2/);
    expect(reason('holmes-1')).toMatch(/Overdue/);
    expect(reason('hound-1')).toMatch(/waiting/);
  });
});

describe('reading sessions', () => {
  it('marks in-library use, then awaiting reshelving when ended', () => {
    const state = fresh();
    const session = rules.startReadingSession(state, { memberId: 'm-noor', copyId: 'pride-3' }, NOW);
    expect(rules.getCopy(state, 'pride-3').status).toBe('in_library_use');
    expect(() => rules.checkout(state, { memberId: 'm-tom', copyId: 'pride-3' }, NOW)).toThrow();
    rules.endReadingSession(state, session.id, NOW);
    expect(rules.getCopy(state, 'pride-3').status).toBe('awaiting_reshelving');
    expect(findInvariantViolations(state)).toEqual([]);
  });
});

describe('overdue', () => {
  it('is computed from the due date of an active loan', () => {
    const loan = { dueAt: NOW.toISOString(), returnedAt: undefined };
    expect(rules.loanState(loan, later(-1))).toBe('due_soon');
    expect(rules.loanState(loan, later(1))).toBe('overdue');
    expect(rules.loanState({ ...loan, returnedAt: later(2).toISOString() }, later(3))).toBe('returned');
    expect(rules.daysOverdue(loan, later(2.5))).toBe(3);
  });
});

describe('scheduled jobs', () => {
  it('are idempotent', () => {
    const state = fresh();
    const first = rules.runScheduledJobs(state, NOW);
    expect(first.some((e) => e.kind === 'overdue_notice')).toBe(true);
    expect(first.some((e) => e.kind === 'long_reading_session')).toBe(true);
    expect(rules.runScheduledJobs(state, NOW)).toEqual([]);
  });
});
