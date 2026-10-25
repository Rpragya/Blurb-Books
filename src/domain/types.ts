/**
 * Domain model.
 *
 * Bibliographic records (BookEdition) are separate from physical items
 * (BookCopy). Circulation records (Loan, Reservation, ReadingSession) always
 * point at a copy or an edition by id — never embed one inside another — so
 * the shapes map cleanly onto REST resources when the mock adapter is
 * replaced by a real backend.
 */

export type ISODateString = string;

export type GenreId =
  | 'mystery'
  | 'fantasy'
  | 'science-fiction'
  | 'romance'
  | 'horror'
  | 'adventure'
  | 'literary'
  | 'children'
  | 'poetry'
  | 'philosophy'
  | 'non-fiction';

export type LanguageCode = 'en' | 'fr' | 'es' | 'de' | 'hi' | 'ru' | 'it';

export type InterestTagId =
  | 'cosy-nights'
  | 'page-turners'
  | 'big-ideas'
  | 'short-reads'
  | 'first-classics'
  | 'love-and-letters'
  | 'strange-worlds'
  | 'read-aloud'
  | 'around-the-world'
  | 'unreliable-narrators';

export type Preview =
  /** Verbatim text from a public-domain edition, with its source. */
  | { kind: 'public-domain-excerpt'; source: string; text: string }
  /** Text written for this demo — not from any published book. */
  | { kind: 'original-demo-text'; text: string };

export interface BookEdition {
  id: string;
  title: string;
  authors: string[];
  genres: GenreId[];
  language: LanguageCode;
  tags: InterestTagId[];
  /** Short editorial description used on cards. */
  description: string;
  /** Longer editorial synopsis written by library staff. */
  synopsis: string;
  themes: string[];
  recommendation?: { staffName: string; text: string };
  preview: Preview;
  /** Optional long-form note carried over from the original Blurb project. */
  blurbNotesFile?: string;
  publisher: string;
  edition: string;
  publishedYear: number;
  /** Year the work was first published (may differ from this edition). */
  firstPublished: number;
  pages: number;
  isbn?: string;
  cover: { hue: number; motif: CoverMotif };
  /** Fictional demo edition — the work is real, the edition record is not. */
  addedAt: ISODateString;
}

export type CoverMotif = 'stripes' | 'circle' | 'arch' | 'grid' | 'wave' | 'diamond';

export type CopyStatus =
  | 'available'
  | 'on_loan'
  | 'in_library_use'
  | 'awaiting_reshelving'
  | 'on_hold_shelf'
  | 'missing'
  | 'in_repair';

export type LoanPolicy = 'lendable' | 'reference';

export interface ShelfLocation {
  rackId: string;
  /** Shelf number counted from the top, starting at 1. */
  shelf: number;
}

export interface BookCopy {
  id: string;
  barcode: string;
  editionId: string;
  policy: LoanPolicy;
  status: CopyStatus;
  /** Home location. Copies return here after reshelving. */
  location: ShelfLocation;
  /** Set while the copy sits on the hold shelf for a reservation. */
  heldForReservationId?: string;
  /** Monotonic version used for optimistic-concurrency checks. */
  version: number;
  updatedAt: ISODateString;
}

export interface Floor {
  id: 'ground' | 'first';
  name: string;
  order: number;
}

export interface Section {
  id: string;
  name: string;
  floorId: Floor['id'];
  /** Plain-language hint for walking there from the kiosk. */
  directionsFromKiosk: string;
  area: Rect;
}

export interface Rack {
  id: string;
  label: string;
  sectionId: string;
  shelves: number;
  rect: Rect;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorPlan {
  floors: Floor[];
  sections: Section[];
  racks: Rack[];
  kiosk: { floorId: Floor['id']; x: number; y: number };
  desk: { floorId: Floor['id']; rect: Rect };
}

export interface Member {
  id: string;
  name: string;
  cardNumber: string;
  /** Demo only — a real system never ships credentials to the client. */
  demoPin: string;
  standing: 'good' | 'suspended';
  savedEditionIds: string[];
}

export interface Loan {
  id: string;
  copyId: string;
  memberId: string;
  issuedAt: ISODateString;
  dueAt: ISODateString;
  renewals: number;
  returnedAt?: ISODateString;
}

export type ReservationStatus = 'waiting' | 'ready' | 'collected' | 'cancelled' | 'expired';

export interface Reservation {
  id: string;
  editionId: string;
  memberId: string;
  /** Sequence number that fixes queue order even if timestamps tie. */
  sequence: number;
  createdAt: ISODateString;
  status: ReservationStatus;
  copyId?: string;
  readyAt?: ISODateString;
  pickupBy?: ISODateString;
  closedAt?: ISODateString;
}

export interface ReadingSession {
  id: string;
  copyId: string;
  memberId: string;
  startedAt: ISODateString;
  endedAt?: ISODateString;
}

export type CopyReportKind = 'not_on_shelf' | 'misplaced' | 'damaged';

export interface CopyReport {
  id: string;
  copyId: string;
  kind: CopyReportKind;
  source: 'kiosk' | 'staff';
  note: string;
  createdAt: ISODateString;
  resolvedAt?: ISODateString;
  resolution?: 'found' | 'marked_missing' | 'no_issue';
}

export type CirculationEventKind =
  | 'due_soon_reminder'
  | 'overdue_notice'
  | 'reservation_ready'
  | 'pickup_expired'
  | 'long_reading_session';

/** Output of the automation simulation. Nothing is ever actually sent. */
export interface CirculationEvent {
  id: string;
  at: ISODateString;
  kind: CirculationEventKind;
  message: string;
  memberId?: string;
  /** Dedupes repeated runs: one event per subject per kind. */
  key: string;
}

/** Everything the mock "server" owns. */
export interface LibraryState {
  editions: BookEdition[];
  copies: BookCopy[];
  members: Member[];
  loans: Loan[];
  reservations: Reservation[];
  sessions: ReadingSession[];
  reports: CopyReport[];
  events: CirculationEvent[];
  nextSequence: number;
  idCounter: number;
}
