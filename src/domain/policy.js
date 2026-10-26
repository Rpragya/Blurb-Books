/** Circulation policy. In production these values come from the server. */
export const POLICY = {
  loanDays: 14,
  maxRenewals: 2,
  maxActiveLoans: 5,
  /** Members with a loan overdue by more than this cannot borrow. */
  blockingOverdueDays: 14,
  pickupDays: 3,
  dueSoonDays: 3,
  longReadingSessionHours: 3,
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;

export function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

/** Due dates fall at the end of the library day so "due today" reads naturally. */
export function endOfDay(iso) {
  const d = new Date(iso);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}
