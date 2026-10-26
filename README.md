# Blurb Books

Blurb Books helps visitors find books in a physical library and helps staff run circulation. It is a frontend portfolio project built with React, TypeScript and Vite, running against a typed in-browser mock API.

It has three connected experiences:

- **Library kiosk** (`/`): browse by mood or genre, search and filter, preview a book, find its exact shelf on an interactive map, and continue on a phone with a QR code. No sign-in needed.
- **Member area** (`/member`): loans and due dates, renewal eligibility with reasons, reservation queue status, and saved books. Built for shared screens, with an inactivity warning and a full clear when the session ends.
- **Librarian workspace** (`/staff`): an action-first overview, the checkout/return/reading-session desk, loans with overdue filters, reservations and the pickup queue, the reshelving list, catalogue and copy management, missing/misplaced reports, and demo controls.

> **Demo.** Sign-in, staff access, notifications and circulation enforcement are simulated in the browser. See [Real vs simulated](#real-vs-simulated).

## Setup

Requires Node 20+ and npm.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm run preview      # serve the build
npm run lint
npm run typecheck
npm test             # Vitest + React Testing Library
npx playwright install chromium   # once
npm run test:e2e     # Playwright (starts its own dev server on :4317)
SCREENS=1 npx playwright test screens   # optional: review screenshots → test-results/screens
```

## Try the story

The demo is built to show this story:

> A visitor discovers a mystery novel, previews it, finds its rack, and borrows a copy through the librarian desk. Another member reserves the title when no eligible copies are available. Returning a copy assigns it to the reservation. After collection or expiry, the copy follows the correct next state.

1. Open `/`, choose **Mystery & Crime**, then tick **Can borrow today**.
2. On *Murder at the Mapleford Library*, choose **Preview**, close it, then choose **Locate** (Ground floor → Crime & Gothic → Rack M3 → Shelf 3).
3. In a second tab, open `/staff`, enter as librarian, go to **Checkout & return**, find member **Noor**, scan `BB000101`, then **Confirm checkout**.
4. Back in the kiosk tab, the book now shows **All copies on loan**. Choose **Sign in to reserve** and sign in as Tom (`20010002` / `2345`) → **Reserve**.
5. At the desk, go to **Return** and scan `BB000102`. The result says to put it on the hold shelf for Tom.
6. In **Reservations**, choose **Check out to member** to collect it. To see expiry instead: on *The Wonderful Wizard of Oz*, choose **Expire & pass on** (it passes to Tom), then in **Demo controls** advance **+1 week** (Tom's window lapses and the copy goes to reshelving).

`e2e/story.spec.ts` automates this whole story.

### Demo accounts

| Card | PIN | Scenario |
| --- | --- | --- |
| 20010001 | 1234 | Asha: 4 loans (1 overdue, 1 at the renewal limit), a hold ready, a waiting reservation |
| 20010002 | 2345 | Tom: renewal blocked because someone is waiting for his book |
| 20010003 | 3456 | Lin: a lapsed pickup, an active reading session |
| 20010004 | 4567 | Rafael: borrowing paused (item more than 14 days overdue) |
| 20010005 | 5678 | Noor: new member, nothing borrowed |
| 20010006 | 6789 | Ellie: suspended membership |

Staff access is a role switch on `/staff`. It is not authentication.

## Architecture

```
src/
  domain/        Types and business rules (pure, framework-free, unit-tested)
    types.ts           BookEdition vs BookCopy, Loan, Reservation, ReadingSession…
    circulation.ts     checkout / return / reshelve / renew / reserve / expire / sessions
    availability.ts    "Two copies available", "All copies on loan", …
    location.ts        Text directions ("Ground floor → Fiction → Rack F3 → Shelf 2")
    search.ts          URL ⇄ search-state parsing, relevance scoring
    invariants.ts      Cross-record consistency checks
    textStats.ts       Word stats + safe highlighting (ported from the original Blurb)
  api/
    types.ts           LibraryApi interface + DTOs: the contract the UI depends on
    ApiContext.tsx     Injects the adapter; online/offline status
    queries.ts         TanStack Query keys, hooks, mutation wrapper
    mock/              The in-browser "server": fixtures, seed, floor plan, mockApi
  session/       Member kiosk session (memory only, idle timeout), demo staff role
  app/           Routes (staff chunk lazy-loaded), focus management
  ui/            Reusable components: Button, Dialog, Cover, badges, Field, feedback
  features/
    kiosk/       Welcome, Explore, Search, Book, Map, Handoff
    member/      Sign-in + dashboard
    staff/       Workspace pages
  styles/        Design tokens + component/kiosk/staff CSS
```

### Who owns which state

| State | Owner | Notes |
| --- | --- | --- |
| Loans, copies, reservations, availability | The API (mock "server") | The UI never holds an authoritative copy. Every view reads it through TanStack Query, and every mutation refreshes all queries. |
| Search text, filters, sort, page, open preview | URL | Survives opening a book and coming back, can be shared, and Back works. |
| Member session | React memory in `MemberSessionProvider` | Never written to storage. Ending a session removes all `['member', …]` queries. |
| Staff role | `sessionStorage` flag | Demo convenience only. |
| Form input, dialog open state, desk receipts | Component state | Kept after recoverable errors. |
| Demo settings (latency, failures, offline) | `localStorage` | Demo controls only. |

The business rules live in `src/domain/circulation.ts`. The mock adapter runs each mutation as a transaction: clone the state, apply the rule, check the invariants, then commit. Components only call the API and render the eligibility and reasons the API returns. A Django REST backend would replace `createMockApi()` in `src/main.tsx` with an adapter that implements the same `LibraryApi` interface using `fetch`, passing each query's `AbortSignal` through.

### Circulation rules implemented

- **Edition vs copy.** Reservations are per edition. Loans, sessions and holds are per copy (each copy has its own barcode, home shelf, status and version).
- **Checkout** checks the member's eligibility (standing, 5-loan limit, nothing more than 14 days overdue) and the copy (lendable, on the shelf, or held for this member). It previews the due date, then re-validates against the copy's `version` when confirmed. A stale scan gets a conflict message and a **Check again** button.
- **Return** closes the loan. The copy goes to the head of the reservation queue (hold shelf, 3-day pickup window) or to **awaiting reshelving**. It becomes shelf-available only after a **reshelve** action, which checks the queue again.
- **Reading sessions** record that a copy is in use in the library. Ending one sends the copy to reshelving. Sessions over 3 hours are flagged.
- **Renewal** is blocked at 2 renewals, when the item is overdue, when the membership is suspended, or when someone else is waiting.
- **Pickup expiry and cancellation** pass the copy to the next person in the queue, otherwise to reshelving.
- **Overdue** is always computed from an active loan's due date.

### Async behaviour

- Each search parameter set has its own cache entry, so a late response can only fill its own entry and can never overwrite newer results. Superseded requests are cancelled through `AbortSignal`, and the previous results stay on screen, dimmed, while new ones load.
- Loading uses skeletons and spinners. Errors offer a retry and keep showing the last data when there is some. Freshness timestamps appear wherever stale availability could mislead.
- Mutations disable their buttons while pending. Each one sends an idempotency key, reused if the same payload is retried and replaced after success. The mock honours these keys.
- Changes made in one tab show up in other open tabs via the `storage` event. This stands in for server push.
- Offline (real, or simulated in Demo controls) shows a banner and disables circulation actions. Nothing is queued locally or claimed as confirmed.

### Accessibility

- Semantic landmarks, a skip link, and one `<h1>` per page that receives focus after navigation. On Back, focus returns to the card the user opened.
- The dialog is a custom modal: it makes the page behind it `inert`, traps Tab, closes on Escape and restores focus. The book preview dialog lives in the URL (`?preview=id`), so Back closes it and the link can be shared.
- Live regions announce result counts, desk outcomes and session timeouts.
- Filter chips are real checkboxes and radios. Status is always icon + text, never colour alone.
- The map has a full text equivalent (breadcrumb + steps + shelf diagram label). Racks are focusable buttons.
- Touch targets are 48px in the kiosk and denser in the workspace. `prefers-reduced-motion` turns off pulses and transitions.
- **Shared screens:** after 90s idle, a warning with a 30s countdown appears (**Continue** / **End session now**). On timeout or exit, personal data is removed and the screen returns to public browsing. Demo controls offer a 15s + 10s option for demos.

### Design

The public site follows an editorial reference: full-bleed library photography, clean sans headlines (Inter) with a serif italic accent word (Fraunces), squarer controls, and covers as the main visual. One accent colour runs through everything: the Blurb violet. Fonts are self-hosted through `@fontsource`, so they work offline. Book covers are generated from SVG and type, so there are no broken images or licensing questions. The librarian workspace uses the same tokens at a denser rhythm, with worklists instead of charts.

**Light and dark themes.** Every colour is a semantic token in `src/styles/tokens.css`, defined once for light and once for dark. The theme follows the OS setting until the reader uses the toggle in the header or staff bar. The choice is stored and applied before first paint by an inline script in `index.html`, so there's no flash. Where the View Transitions API exists, the new theme spreads in a circle from the toggle. The accent has two roles, `--accent` for text and `--accent-fill` for solid buttons, so both pass contrast in both themes.

**Motion** (`framer-motion`, primitives in `src/ui/motion.tsx`):
- **Landing:** the hero photo moves slower than the page, the headline rises in word by word, and the hero content fades out as you scroll.
- **Sections:** reveal as they scroll in, with staggered cards and parallax inside the genre photos.
- **Covers:** follow the pointer with a 3D tilt.
- **Mood rows:** two rows of mood links drift in opposite directions and pause on hover or focus.
- **Catalogue:** cards glide to their new positions when filters change.
- **Shelf map:** the dotted route draws itself from "You are here" to the rack, which pulses.
- **Navigation:** pages fade in on route change, and the header hides while scrolling down and returns on scroll up.

Nothing waits on an animation to become usable. With `prefers-reduced-motion`, `MotionConfig reducedMotion="user"` plus explicit checks turn off parallax, tilt, marquee and pulses (the marquee becomes a static wrap).

**Photography.** Photos are stored locally as responsive WebP versions (`srcset`) generated from the Unsplash originals listed in `public/images/credits.md`. The hero image loads with high priority; the rest load lazily.

## Demo data

The demo has 37 editions in 11 genres and 7 languages (English, French, Spanish, German, Italian, Russian, Hindi) and 55 copies across 18 racks on two floors. It includes 6 members, 12 active loans (3 overdue), 2 reading sessions (1 long), 5 open reservations (one hold with a lapsed pickup window) and 2 open copy reports, plus copies awaiting reshelving, missing or in repair.

- Previews are labelled. They are either **public-domain excerpts** with their source (verbatim openings of pre-1930 texts), or **original demo text** written for this project (fictional titles such as *Murder at the Mapleford Library*). Synopses and recommendations are original editorial text. *Harry Potter* is in copyright, so no excerpt is shown for it.
- All dates are relative to a demo clock. When you return after a break, every timestamp shifts by the time you were away, so overdue and pickup states stay meaningful. **Demo controls** can advance the clock and **Reset demo data**.
- `src/domain/invariants.ts` checks that copy statuses, loans, sessions and holds agree. It runs in tests and after every mutation in dev.

## Real vs simulated

| Area | Here | Production requirement |
| --- | --- | --- |
| Data & rules | In-browser mock with transactions, versions and idempotency keys | Server-side transactional checkout with row locks on the copy, unique constraint on one active loan per copy, stored idempotency keys |
| Member sign-in | Card + PIN checked in the browser; PINs are in the fixtures | Server-verified credentials, httpOnly session cookie, rate limiting |
| Staff access | Role switch | Staff authentication; every staff endpoint enforces the role on the server |
| Notifications | Simulated log in Demo controls; **nothing is sent** | Scheduler + email/SMS provider |
| Scheduled jobs | Run when the demo clock advances or on demand | Cron/worker |
| Real-time sync | `storage` events between tabs | Server push or polling |
| Shelf map | Static location guide | Same; the app never claims live indoor tracking |
| QR handoff | Real QR codes of real public routes (allow-listed) | Same, served from the public origin |

## Verification

Run on Linux (Node 24, Chromium headless shell 156) on 25 Oct 2026:

- `npm run lint`, `npm run typecheck` and `npm run build` pass.
- `npm test`: **63 passing**. Domain rules (no double checkout, version conflicts, return → hold, pickup expiry chain, renewal blocks, sessions, idempotent jobs, seed invariants), mock API (abort, idempotency, racing desks, offline), and integration tests on the real routes:
  - filters survive opening a book and pressing Back, with focus restored to the card;
  - direct links to books;
  - the preview dialog opens from the URL, closes on Escape and restores focus, and Tab stays inside it;
  - a slow, stale search response doesn't replace newer results;
  - text directions render without the map;
  - the kiosk report reaches staff;
  - QR allow-list;
  - kiosk timeout warns, can be continued, then clears personal data and member queries;
  - reserving;
  - the desk refuses a second checkout of a copy and shows a conflict on a stale scan;
  - a return updates the reservations page and the public book page;
  - reshelving gates availability; reading sessions; overdue filter;
  - the theme toggle follows the system, then persists an explicit choice.
- Light and dark themes were reviewed from headless-Chromium screenshots at 1440px, 820px and 390px.
- `npm run test:e2e`: **3 passing** in desktop Chromium. The full definition-of-done story across a kiosk tab and a staff tab; no horizontal overflow on 8 kiosk pages at 360, 390, 820, 1180 and 1366px wide; the skip link is the first tab stop and focus moves to the new page heading.

Not measured: no Lighthouse, axe or screen-reader audit was run, and real iPad hardware wasn't tested. The responsive checks above are viewport emulation in headless Chromium.

## Known limitations and tradeoffs

- **The mock is the backend.** Data lives in this browser's `localStorage`. Two different browsers don't share data.
- **Main bundle about 184 kB gzipped.** It includes React, the router, TanStack Query, framer-motion (about 45 kB) and the mock API with all fixtures. The staff workspace is split out (about 13 kB gzipped). Next steps would be framer-motion's `LazyMotion` with `m` components and code-splitting the kiosk routes. With a real API, the fixtures also leave the bundle.
- **No offline cache persistence.** Catalogue and map data stay in memory for the session (the map is cached indefinitely), but nothing persists across reloads while offline.
- **Kiosk "attract mode"** (resetting public browsing after long idle) isn't implemented. Only member sessions time out.
- **AI discovery isn't implemented.** The non-AI path (Explore + search) is complete. Adding AI would need a server-side endpoint that keeps the API key off the client and searches only this catalogue.
- **Original Blurb notes.** The three `.txt` blurbs from the first version of this project are kept and shown as "Blurb notes", with find-in-text and word insights. The *Pride and Prejudice* and *Sherlock Holmes* notes read like encyclopaedia text: **check their source** before publishing this project.
