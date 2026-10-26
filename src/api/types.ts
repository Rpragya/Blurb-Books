/**
 * The contract between the UI and whatever serves library data.
 *
 * The mock adapter (src/api/mock) implements it in the browser. A Django REST
 * adapter would implement the same interface with fetch(), passing `signal`
 * through so cancelled queries abort their HTTP requests.
 */
import type { AvailabilitySummary } from '../domain/availability';
import type { CheckoutPreview, Eligibility, LoanState, RenewalEligibility } from '../domain/circulation';
import type { SearchParams } from '../domain/search';
import type {
  BookCopy,
  BookEdition,
  CirculationEvent,
  CopyReport,
  CopyReportKind,
  CopyStatus,
  FloorPlan,
  GenreId,
  Loan,
  LoanPolicy,
  Member,
  ReadingSession,
  Reservation,
  ShelfLocation,
} from '../domain/types';

export interface RequestOptions {
  signal?: AbortSignal;
}

export type ApiErrorKind = 'offline' | 'network' | 'conflict' | 'validation' | 'not_found' | 'server';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

// --- Public catalogue -------------------------------------------------------

export interface BookSummary {
  edition: BookEdition;
  availability: AvailabilitySummary;
}

export interface SearchResponse {
  items: BookSummary[];
  total: number;
  page: number;
  pageCount: number;
  /** Server time the availability figures were computed. */
  asOf: string;
}

/** A copy as shown on public screens: no borrower details. */
export interface PublicCopy {
  id: string;
  barcode: string;
  policy: LoanPolicy;
  status: CopyStatus;
  location: ShelfLocation;
  dueAt?: string;
}

export interface BookDetail extends BookSummary {
  copies: PublicCopy[];
  similar: BookSummary[];
  /** Number of members waiting — a count only, never who. */
  queueLength: number;
  asOf: string;
}

export interface HomeResponse {
  staffPicks: BookSummary[];
  newArrivals: BookSummary[];
  availableNow: number;
  totalTitles: number;
  genreCounts: Record<GenreId, number>;
  asOf: string;
}

// --- Member area -----------------------------------------------------------

export interface MemberSessionInfo {
  memberId: string;
  name: string;
  /** Demo token; a real API would use an httpOnly session cookie. */
  token: string;
}

export interface MemberLoanView {
  loan: Loan;
  edition: BookEdition;
  state: LoanState;
  daysOverdue: number;
  renewal: RenewalEligibility;
}

export interface MemberReservationView {
  reservation: Reservation;
  edition: BookEdition;
  position?: number;
  pickupLocation?: string;
}

export interface MemberOverview {
  member: Pick<Member, 'id' | 'name' | 'standing' | 'savedEditionIds'>;
  loans: MemberLoanView[];
  reservations: MemberReservationView[];
  saved: BookSummary[];
  borrowing: Eligibility;
  asOf: string;
}

// --- Staff workspace -------------------------------------------------------

export interface StaffMemberView {
  member: Omit<Member, 'demoPin'>;
  activeLoans: number;
  overdueLoans: number;
  borrowing: Eligibility;
}

export interface CopyLookup {
  copy: BookCopy;
  edition: BookEdition;
  locationText?: string;
  activeLoan?: { loan: Loan; memberName: string; state: LoanState };
  activeSession?: { session: ReadingSession; memberName: string };
  hold?: { reservation: Reservation; memberName: string };
  waitingCount: number;
}

export interface CheckoutPreviewView extends Omit<CheckoutPreview, 'collectsReservation'> {
  collectsReservation: boolean;
  member: StaffMemberView;
}

export type ReturnResult =
  | { kind: 'reshelve'; title: string; barcode: string; memberName: string; wasOverdueDays: number }
  | { kind: 'hold'; title: string; barcode: string; memberName: string; wasOverdueDays: number; holdFor: string; pickupBy: string };

export interface LoanRow {
  loan: Loan;
  title: string;
  barcode: string;
  memberName: string;
  cardNumber: string;
  state: LoanState;
  daysOverdue: number;
}

export interface ReservationRow {
  reservation: Reservation;
  title: string;
  memberName: string;
  cardNumber: string;
  position?: number;
  barcode?: string;
  pickupExpired: boolean;
}

export interface SessionRow {
  session: ReadingSession;
  title: string;
  barcode: string;
  memberName: string;
  isLong: boolean;
}

export interface CopyRow {
  copy: BookCopy;
  title: string;
  locationText: string;
}

export interface ReportRow {
  report: CopyReport;
  title: string;
  barcode: string;
  copyStatus: CopyStatus;
  locationText: string;
}

export interface CatalogueRow {
  edition: BookEdition;
  availability: AvailabilitySummary;
  copies: CopyRow[];
}

export interface StaffOverview {
  overdue: LoanRow[];
  dueToday: number;
  readyForPickup: ReservationRow[];
  expiredPickups: ReservationRow[];
  reshelving: CopyRow[];
  openReports: ReportRow[];
  activeSessions: SessionRow[];
  loansIssuedToday: number;
  returnsToday: number;
  asOf: string;
}

export interface DemoSettings {
  latencyMs: [number, number];
  failureRate: number;
  offline: boolean;
}

export interface DemoClock {
  now: string;
  offsetMs: number;
}

/** Every mutation carries an idempotency key so a retried request is applied once. */
export interface MutationOptions {
  idempotencyKey?: string;
}

export interface LibraryApi {
  // Public
  getHome(opts?: RequestOptions): Promise<HomeResponse>;
  searchBooks(params: SearchParams, opts?: RequestOptions): Promise<SearchResponse>;
  getBook(editionId: string, opts?: RequestOptions): Promise<BookDetail>;
  getFloorPlan(opts?: RequestOptions): Promise<FloorPlan>;
  reportCopyIssue(input: { copyId: string; kind: CopyReportKind; note: string; source: 'kiosk' | 'staff' }, opts?: MutationOptions): Promise<CopyReport>;

  // Member (demo authentication)
  memberSignIn(cardNumber: string, pin: string): Promise<MemberSessionInfo>;
  getMemberOverview(memberId: string, opts?: RequestOptions): Promise<MemberOverview>;
  toggleSaved(memberId: string, editionId: string): Promise<{ saved: boolean }>;
  getReservationEligibility(memberId: string, editionId: string, opts?: RequestOptions): Promise<Eligibility & { queueLength: number }>;
  reserve(memberId: string, editionId: string, opts?: MutationOptions): Promise<{ reservation: Reservation; position: number }>;
  cancelReservation(reservationId: string, opts?: MutationOptions): Promise<Reservation>;
  renewLoan(loanId: string, opts?: MutationOptions): Promise<Loan>;

  // Staff
  getStaffOverview(opts?: RequestOptions): Promise<StaffOverview>;
  findMembers(query: string, opts?: RequestOptions): Promise<StaffMemberView[]>;
  getStaffMember(memberId: string, opts?: RequestOptions): Promise<StaffMemberView>;
  lookupCopy(barcode: string, opts?: RequestOptions): Promise<CopyLookup>;
  previewCheckout(memberId: string, barcode: string, opts?: RequestOptions): Promise<CheckoutPreviewView>;
  checkout(input: { memberId: string; copyId: string; expectedVersion: number }, opts?: MutationOptions): Promise<Loan>;
  returnCopy(input: { copyId: string }, opts?: MutationOptions): Promise<ReturnResult>;
  startSession(input: { memberId: string; copyId: string; expectedVersion: number }, opts?: MutationOptions): Promise<ReadingSession>;
  endSession(sessionId: string, opts?: MutationOptions): Promise<ReadingSession>;
  reshelve(copyId: string, opts?: MutationOptions): Promise<{ heldFor?: string }>;
  listLoans(opts?: RequestOptions): Promise<LoanRow[]>;
  listReservations(opts?: RequestOptions): Promise<ReservationRow[]>;
  expireReservation(reservationId: string, opts?: MutationOptions): Promise<Reservation>;
  listSessions(opts?: RequestOptions): Promise<SessionRow[]>;
  listCatalogue(query: string, opts?: RequestOptions): Promise<CatalogueRow[]>;
  updateCopy(input: { copyId: string; expectedVersion: number; status?: CopyStatus; location?: ShelfLocation; policy?: LoanPolicy }, opts?: MutationOptions): Promise<BookCopy>;
  addCopy(input: { editionId: string; location: ShelfLocation; policy: LoanPolicy }, opts?: MutationOptions): Promise<BookCopy>;
  listReports(opts?: RequestOptions): Promise<ReportRow[]>;
  resolveReport(reportId: string, resolution: NonNullable<CopyReport['resolution']>, opts?: MutationOptions): Promise<CopyReport>;

  // Demo controls (would not exist in production)
  getClock(): Promise<DemoClock>;
  advanceClock(ms: number): Promise<DemoClock>;
  runScheduledJobs(): Promise<CirculationEvent[]>;
  listEvents(opts?: RequestOptions): Promise<CirculationEvent[]>;
  resetDemo(): Promise<void>;
  getSettings(): DemoSettings;
  updateSettings(patch: Partial<DemoSettings>): void;
  /** Notifies when data changed elsewhere (another tab). */
  subscribe(listener: () => void): () => void;
}
