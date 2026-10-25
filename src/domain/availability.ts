import type { BookCopy, Loan } from './types';

export type AvailabilityKind =
  | 'available'
  | 'reference_only'
  | 'reshelving'
  | 'all_on_loan'
  | 'unavailable'
  | 'no_copies';

export interface AvailabilitySummary {
  kind: AvailabilityKind;
  /** e.g. "Two copies available" */
  label: string;
  detail?: string;
  totalCopies: number;
  /** Lendable copies on the shelf right now. */
  lendableOnShelf: number;
  /** Any copy (lendable or reference) on the shelf — can be located. */
  onShelf: number;
  nextDueAt?: string;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? singular : pluralForm;
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/**
 * Summarise an edition's copies into one honest, specific state for cards.
 * Precedence: borrowable now > readable here > coming back soon > out.
 */
export function summariseAvailability(copies: BookCopy[], activeLoans: Loan[]): AvailabilitySummary {
  const total = copies.length;
  const lendableOnShelf = copies.filter((c) => c.status === 'available' && c.policy === 'lendable').length;
  const referenceOnShelf = copies.filter((c) => c.status === 'available' && c.policy === 'reference').length;
  const onShelf = lendableOnShelf + referenceOnShelf;
  const reshelving = copies.filter((c) => c.status === 'awaiting_reshelving').length;
  const onLoan = copies.filter((c) => c.status === 'on_loan');
  const loanIds = new Set(onLoan.map((c) => c.id));
  const nextDueAt = activeLoans
    .filter((l) => loanIds.has(l.copyId))
    .map((l) => l.dueAt)
    .sort()[0];
  const base = { totalCopies: total, lendableOnShelf, onShelf, nextDueAt };

  if (total === 0) return { ...base, kind: 'no_copies', label: 'Not in this library' };

  if (lendableOnShelf > 0) {
    return {
      ...base,
      kind: 'available',
      label: `${countWord(lendableOnShelf)} ${plural(lendableOnShelf, 'copy', 'copies')} available`,
      detail: referenceOnShelf > 0 ? `Plus ${referenceOnShelf} reference ${plural(referenceOnShelf, 'copy', 'copies')}` : undefined,
    };
  }
  if (referenceOnShelf > 0) {
    return {
      ...base,
      kind: 'reference_only',
      label: 'In-library use only',
      detail: onLoan.length > 0 ? 'Borrowable copies are on loan' : 'Read it here — ask staff to record a session',
    };
  }
  if (reshelving > 0) {
    return {
      ...base,
      kind: 'reshelving',
      label: 'Awaiting reshelving',
      detail: 'Recently returned — ask at the help desk',
    };
  }
  if (onLoan.length === total) {
    return {
      ...base,
      kind: 'all_on_loan',
      label: total === 1 ? 'On loan' : 'All copies on loan',
      detail: nextDueAt ? `Next due back ${shortDate.format(new Date(nextDueAt))}` : undefined,
    };
  }
  const inUse = copies.some((c) => c.status === 'in_library_use');
  const onHold = copies.some((c) => c.status === 'on_hold_shelf');
  return {
    ...base,
    kind: 'unavailable',
    label: 'Temporarily unavailable',
    detail: inUse
      ? 'Being read in the library right now'
      : onHold
        ? 'Reserved for another reader'
        : onLoan.length > 0 && nextDueAt
          ? `Next due back ${shortDate.format(new Date(nextDueAt))}`
          : 'Being repaired or located by staff',
  };
}
