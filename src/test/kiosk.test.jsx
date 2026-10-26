import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createTestApi, renderApp } from './renderApp';

const results = () => screen.findByRole('heading', { level: 2, name: /\d+ books?/ });

describe('search, filters and navigation', () => {
  it('keeps filters in the URL when opening a book and going back, and restores focus to the card', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/search');
    await results();

    await user.click(screen.getAllByRole('checkbox', { name: 'Mystery & Crime' })[0]);
    await user.click(screen.getAllByRole('radio', { name: /Can borrow today/ })[0]);
    await waitFor(() => expect(router.state.location.search).toBe('?genre=mystery&avail=borrow-now'));
    await screen.findByRole('heading', { level: 2, name: '3 books' });

    await user.click(screen.getByRole('link', { name: 'Murder at the Mapleford Library' }));
    await screen.findByRole('heading', { level: 1, name: 'Murder at the Mapleford Library' });
    expect(router.state.location.pathname).toBe('/books/mapleford');

    await user.click(screen.getByRole('button', { name: 'Back to results' }));
    await screen.findByRole('heading', { level: 2, name: '3 books' });
    expect(router.state.location.search).toBe('?genre=mystery&avail=borrow-now');
    expect(screen.getAllByRole('checkbox', { name: 'Mystery & Crime' })[0]).toBeChecked();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Murder at the Mapleford Library' })).toHaveFocus());
  });

  it('supports direct links to book details', async () => {
    renderApp('/books/dracula');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dracula' })).toBeInTheDocument();
    expect(screen.getAllByText('All copies on loan').length).toBeGreaterThan(0);
    // No borrower identity on a public screen.
    expect(screen.queryByText(/Tom Becker|Lin Zhou/)).not.toBeInTheDocument();
  });

  it('opens the preview dialog from the URL, closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/search?q=holmes');
    await results();
    const card = screen.getByRole('article', { name: 'The Adventures of Sherlock Holmes' });
    const trigger = within(card).getByRole('link', { name: 'Preview' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'The Adventures of Sherlock Holmes' });
    expect(router.state.location.search).toContain('preview=holmes');
    expect(within(dialog).getByText(/Excerpt · public domain/)).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toBe('?q=holmes');
    await waitFor(() => expect(within(card).getByRole('link', { name: 'Preview' })).toHaveFocus());
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderApp('/search?q=holmes&preview=holmes');
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('link', { name: 'Full details' });
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
  });

  it('shows a useful empty state with a way out', async () => {
    const user = userEvent.setup();
    renderApp('/search?q=holmes&lang=fr');
    expect(await screen.findByRole('heading', { name: /No books match “holmes” with these filters/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Search everything for “holmes”/ }));
    expect(await screen.findByRole('link', { name: 'The Adventures of Sherlock Holmes' })).toBeInTheDocument();
  });

  it('never lets a slow, outdated response replace newer results', async () => {
    const base = createTestApi();
    const resolvers = [];
    const api = {
      ...base,
      // Simulates a server that answers out of order and ignores cancellation.
      searchBooks: (params) =>
        new Promise((resolve) => {
          resolvers.push({ q: params.q, resolve: () => void base.searchBooks(params).then(resolve) });
        }),
    };
    const { router } = renderApp('/search', { api });

    await act(async () => router.navigate('/search?q=frankenstein'));
    await act(async () => router.navigate('/search?q=dracula'));
    await waitFor(() => expect(resolvers.map((r) => r.q)).toEqual(expect.arrayContaining(['frankenstein', 'dracula'])));

    // Newer answers first, then the stale one arrives late.
    await act(async () => resolvers.find((r) => r.q === 'dracula').resolve());
    await screen.findByRole('link', { name: 'Dracula' });
    await act(async () => resolvers.find((r) => r.q === 'frankenstein').resolve());
    await act(async () => resolvers.find((r) => r.q === '')?.resolve());

    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('link', { name: 'Dracula' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Frankenstein' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “dracula”');
  });

  it('shows an error state with retry when the search fails', async () => {
    const base = createTestApi();
    let fail = true;
    const api = {
      ...base,
      searchBooks: async (p, o) => {
        if (fail) throw new Error('The library system did not respond.');
        return base.searchBooks(p, o);
      },
    };
    const user = userEvent.setup();
    renderApp('/search', { api });
    expect(await screen.findByRole('alert')).toHaveTextContent('did not respond');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await results();
  });
});

describe('shelf map', () => {
  it('gives text directions that work without the map', async () => {
    renderApp('/books/mapleford/locate');
    expect(await screen.findByText('Ground floor → Crime & Gothic → Rack M3 → Shelf 3')).toBeInTheDocument();
    const steps = within(screen.getByRole('region', { name: 'Directions' })).getAllByRole('listitem');
    expect(steps.map((s) => s.textContent).join(' ')).toMatch(/3rd shelf from the top/);
    expect(screen.getByRole('button', { name: /Rack M3, Crime & Gothic — your book is here/ })).toBeInTheDocument();
  });

  it('files a “couldn’t find it” report that staff can see', async () => {
    const user = userEvent.setup();
    const { api } = renderApp('/books/mapleford/locate');
    await user.click(await screen.findByRole('button', { name: 'Couldn’t find this book?' }));
    await user.type(screen.getByRole('textbox', { name: /Anything else/ }), 'Not on M3');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('dialog', { name: /staff have been told/ })).toBeInTheDocument();
    const reports = await api.listReports();
    expect(reports.some((r) => r.report.note === 'Not on M3' && r.report.source === 'kiosk')).toBe(true);
  });
});

describe('QR handoff', () => {
  it('encodes only allowed public routes', async () => {
    const { safeHandoffPath } = await import('../features/kiosk/HandoffPage');
    expect(safeHandoffPath('/books/mapleford')).toBe('/books/mapleford');
    expect(safeHandoffPath('/books/mapleford/locate?copy=mapleford-1')).toBe('/books/mapleford/locate?copy=mapleford-1');
    expect(safeHandoffPath('//evil.example')).toBeNull();
    expect(safeHandoffPath('/member')).toBeNull();
    renderApp('/handoff?to=%2Fbooks%2Fmapleford');
    expect(await screen.findByText('http://localhost:3000/books/mapleford')).toBeInTheDocument();
    expect(screen.getByTitle('QR code linking to this page')).toBeInTheDocument();
  });
});

describe('member kiosk session', () => {
  async function signIn(user) {
    await user.type(await screen.findByLabelText('Card number', { exact: false }), '20010001');
    await user.type(screen.getByLabelText('PIN'), '1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { level: 1, name: 'Hello, Asha' });
  }

  it('shows loans, renewal eligibility and reservations', async () => {
    const user = userEvent.setup();
    renderApp('/member');
    await signIn(user);
    expect(screen.getByText('Overdue 3 days')).toBeInTheDocument();
    expect(screen.getByText(/Already renewed 2 times/)).toBeInTheDocument();
    expect(screen.getByText(/Ready · collect by/)).toBeInTheDocument();
    expect(screen.getByText('Next in line')).toBeInTheDocument();
  });

  it('warns before timing out, can be continued, then clears personal data', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { router, queryClient } = renderApp('/member', { timing: { idleMs: 2000, warningMs: 3000 } });
      await signIn(user);

      await act(async () => vi.advanceTimersByTime(2100));
      const warning = await screen.findByRole('alertdialog', { name: 'Are you still there?' });
      await user.click(within(warning).getByRole('button', { name: 'Continue session' }));
      expect(screen.getByRole('heading', { name: 'Hello, Asha' })).toBeInTheDocument();

      await act(async () => vi.advanceTimersByTime(2100));
      await screen.findByRole('alertdialog');
      await act(async () => vi.advanceTimersByTime(3500));

      await waitFor(() => expect(router.state.location.pathname).toBe('/'));
      expect(screen.queryByText(/Asha/)).not.toBeInTheDocument();
      expect(screen.getAllByText(/Your session timed out/).length).toBeGreaterThan(0);
      expect(queryClient.getQueryCache().findAll({ queryKey: ['member'] })).toHaveLength(0);

      // Public browsing still works; going back to /member shows sign-in, not data.
      await act(async () => router.navigate('/member'));
      expect(await screen.findByRole('heading', { name: 'Sign in with your library card' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reserving an unavailable title puts the member in the queue', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/member?next=/books/dracula');
    await user.type(await screen.findByLabelText('Card number', { exact: false }), '20010005');
    await user.type(screen.getByLabelText('PIN'), '5678');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/books/dracula'));
    await user.click(await screen.findByRole('button', { name: 'Reserve this book' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/number 2/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirm reservation' }));
    expect(await screen.findByText(/you’re number 2 in the queue/)).toBeInTheDocument();
  });
});
