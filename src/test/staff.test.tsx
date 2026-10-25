import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApi, renderApp } from './renderApp';

beforeEach(() => {
  window.sessionStorage.setItem('blurb-books:demo-staff-role', '1');
});

async function pickMember(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(await screen.findByLabelText('Find a member'), name);
  await user.click(await screen.findByRole('button', { name: new RegExp(name) }));
}

async function scan(user: ReturnType<typeof userEvent.setup>, barcode: string) {
  const input = await screen.findByLabelText('Copy barcode');
  await user.clear(input);
  await user.type(input, `${barcode}{Enter}`);
}

describe('circulation desk', () => {
  it('checks out a copy, then refuses a second checkout of the same copy', async () => {
    const user = userEvent.setup();
    const { api } = renderApp('/staff/desk?mode=checkout');
    await pickMember(user, 'Noor');
    await scan(user, 'BB000101');
    expect(await screen.findByText(/Due back/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm checkout' }));
    expect(await screen.findByText('Checked out this visit')).toBeInTheDocument();

    // Same copy again, different member.
    await user.click(screen.getByRole('button', { name: 'Change member' }));
    await pickMember(user, 'Tom');
    await scan(user, 'BB000101');
    expect(await screen.findByText(/already on loan/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm checkout' })).toHaveAttribute('aria-disabled', 'true');

    const loans = await api.listLoans();
    expect(loans.filter((l) => l.barcode === 'BB000101')).toHaveLength(1);
  });

  it('shows a conflict when the copy changes between scan and confirm', async () => {
    const user = userEvent.setup();
    // Like a real backend, this API doesn't push changes to the open desk.
    const base = createTestApi();
    renderApp('/staff/desk?mode=checkout', { api: { ...base, subscribe: () => () => {} } });
    const api = base;
    await pickMember(user, 'Noor');
    await scan(user, 'BB000101');
    await screen.findByText(/Due back/);

    // Another desk lends the same copy first.
    const other = await api.previewCheckout('m-tom', 'BB000101');
    await api.checkout({ memberId: 'm-tom', copyId: other.copy.id, expectedVersion: other.copy.version });

    await user.click(screen.getByRole('button', { name: 'Confirm checkout' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/This copy changed/);
    await user.click(within(alert).getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText(/already on loan/)).toBeInTheDocument();
  });

  it('returning a copy with a waiting reservation sends it to the hold shelf and updates other views', async () => {
    const user = userEvent.setup();
    const { api, router } = renderApp('/staff/desk?mode=return');
    // Hound (BB000105) is on loan to Tom; Lin is waiting for it.
    await scan(user, 'BB000105');
    expect(await screen.findByText(/1 waiting — will go to the hold shelf/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm return' }));
    expect(await screen.findByText(/Put it on the hold shelf/)).toBeInTheDocument();
    expect(screen.getAllByText(/for Lin Zhou/).length).toBeGreaterThan(0);

    await router.navigate('/staff/reservations');
    const pickup = await screen.findByRole('region', { name: /On the hold shelf/ });
    expect(within(pickup).getByText('The Hound of the Baskervilles')).toBeInTheDocument();

    const detail = await api.getBook('hound');
    expect(detail.copies[0]!.status).toBe('on_hold_shelf');
    expect(detail.availability.label).toBe('Temporarily unavailable');
  });

  it('a reshelved copy only becomes available after the reshelving action', async () => {
    const user = userEvent.setup();
    const { api } = renderApp('/staff/reshelving');
    expect((await api.getBook('moonstone')).availability.kind).toBe('reshelving');
    const row = (await screen.findByText('The Moonstone')).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Mark shelved' }));
    await waitFor(async () => expect((await api.getBook('moonstone')).availability.kind).toBe('available'));
  });

  it('records an in-library reading session', async () => {
    const user = userEvent.setup();
    const { api } = renderApp('/staff/desk?mode=session');
    await pickMember(user, 'Noor');
    await scan(user, 'BB000131'); // Pride and Prejudice, copy 1
    await user.click(await screen.findByRole('button', { name: 'Start reading session' }));
    expect(await screen.findByText(/now marked as in-library use/)).toBeInTheDocument();
    const sessions = await api.listSessions();
    expect(sessions.some((s) => s.barcode === 'BB000131' && !s.session.endedAt)).toBe(true);
  });

  it('filters loans to overdue via the URL', async () => {
    renderApp('/staff/loans?filter=overdue');
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveTextContent(/Overdue \d+ days?/);
  });
});
