import { expect, test } from '@playwright/test';

/**
 * The definition-of-done story, end to end, with a kiosk tab and a staff tab
 * sharing one browser profile (state syncs between tabs like two devices
 * talking to one server).
 */

async function enterStaff(page, path) {
  await page.goto(path);
  // The workspace is lazy-loaded: wait for either the role gate or the page itself.
  const enter = page.getByRole('button', { name: /Enter as librarian/ });
  await enter.or(page.locator('#staff-main h1')).first().waitFor();
  if (await enter.isVisible()) await enter.click();
}

async function pickMember(page, name) {
  await page.getByLabel('Find a member').fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
}

async function scan(page, barcode) {
  await page.getByLabel('Copy barcode').fill(barcode);
  await page.getByLabel('Copy barcode').press('Enter');
}

test('discover → preview → locate → borrow → reserve → return assigns hold → collect / expire', async ({ context }) => {
  const kiosk = await context.newPage();
  const staff = await context.newPage();

  // 1. A visitor discovers a mystery novel.
  await kiosk.goto('/');
  await kiosk.getByRole('link', { name: /^Mystery/ }).click();
  await expect(kiosk).toHaveURL(/genre=mystery/);
  await kiosk.getByRole('radio', { name: /Can borrow today/ }).first().check();
  await expect(kiosk).toHaveURL(/avail=borrow-now/);

  // 2. Previews it without leaving the results.
  const card = kiosk.getByRole('article', { name: 'Murder at the Mapleford Library' });
  await card.getByRole('link', { name: 'Preview' }).click();
  const dialog = kiosk.getByRole('dialog', { name: 'Murder at the Mapleford Library' });
  await expect(dialog.getByText('Original demo text · not from a published book')).toBeVisible();
  await kiosk.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(kiosk).toHaveURL(/avail=borrow-now$/);

  // 3. Finds its rack.
  await card.getByRole('link', { name: 'Locate' }).click();
  await expect(kiosk.getByText('Ground floor → Crime & Gothic → Rack M3 → Shelf 3')).toBeVisible();
  await expect(kiosk.getByRole('button', { name: /Rack M3.*your book is here/ })).toBeVisible();

  // 4. Borrows the copy at the librarian desk.
  await enterStaff(staff, '/staff/desk?mode=checkout');
  await pickMember(staff, 'Noor');
  await scan(staff, 'BB000101');
  await expect(staff.getByText(/Due back/)).toBeVisible();
  await staff.getByRole('button', { name: 'Confirm checkout' }).click();
  await expect(staff.getByText('Checked out this visit')).toBeVisible();

  // The kiosk tab updates without a reload: no eligible copies left.
  await kiosk.goto('/books/mapleford');
  await expect(kiosk.getByText('All copies on loan').first()).toBeVisible();

  // 5. Another member reserves the title.
  await kiosk.getByRole('link', { name: 'Sign in to reserve' }).click();
  await kiosk.getByLabel(/Card number/).fill('20010002');
  await kiosk.getByLabel('PIN').fill('2345');
  await kiosk.getByRole('button', { name: 'Sign in' }).click();
  await kiosk.getByRole('button', { name: 'Reserve this book' }).click();
  await kiosk.getByRole('button', { name: 'Confirm reservation' }).click();
  await expect(kiosk.getByText(/you’re number 1 in the queue/)).toBeVisible();
  await kiosk.getByRole('button', { name: 'End session' }).first().click();
  await expect(kiosk.getByText(/personal details have been cleared/)).toBeVisible();

  // 6. Returning a copy assigns it to the reservation.
  await staff.goto('/staff/desk?mode=return');
  await scan(staff, 'BB000102');
  await expect(staff.getByText(/1 waiting — will go to the hold shelf/)).toBeVisible();
  await staff.getByRole('button', { name: 'Confirm return' }).click();
  await expect(staff.getByText(/Put it on the hold shelf/)).toBeVisible();
  await expect(staff.getByText(/for Tom Becker/).first()).toBeVisible();

  // 7a. Collection: the held copy can only go to Tom, and becomes a loan.
  await staff.goto('/staff/reservations');
  const row = staff.getByRole('row', { name: /Murder at the Mapleford Library/ });
  await row.getByRole('link', { name: 'Check out to member' }).click();
  await expect(staff.getByText('Collecting a reservation')).toBeVisible();
  await staff.getByRole('button', { name: 'Confirm checkout' }).click();
  await expect(staff.getByText('Checked out this visit')).toBeVisible();

  // 7b. Expiry: Lin's Oz hold has lapsed → passes to Tom → after a week, to reshelving.
  await staff.goto('/staff/reservations');
  const oz = staff.getByRole('row', { name: /Wonderful Wizard of Oz/ });
  await oz.getByRole('button', { name: 'Expire & pass on' }).click();
  await expect(staff.getByRole('row', { name: /Wonderful Wizard of Oz.*Tom Becker/ })).toBeVisible();
  await staff.goto('/staff/simulation');
  await staff.getByRole('button', { name: '+1 week' }).click();
  await expect(staff.getByText(/Pickup window ended for Tom Becker/)).toBeVisible();
  await staff.goto('/staff/reshelving');
  await expect(staff.getByRole('row', { name: /Wonderful Wizard of Oz/ })).toBeVisible();
});

test('no horizontal scrolling on phone, tablet and desktop', async ({ page }) => {
  const paths = ['/', '/explore', '/search?genre=mystery', '/books/pride', '/books/mapleford/locate', '/map', '/member', '/handoff?to=%2Fbooks%2Fpride'];
  for (const width of [360, 390, 820, 1180, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('keyboard: skip link and focus moves to the new page heading', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.getByRole('link', { name: 'The collection', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Discover your next chapter.' })).toBeFocused();
});
