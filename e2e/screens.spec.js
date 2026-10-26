import { test } from '@playwright/test';

// Visual review helper: `SCREENS=1 npx playwright test screens` writes screenshots to test-results/screens.
test.skip(!process.env.SCREENS, 'screenshots only on demand');

const shots = [
  ['welcome-desktop', '/', { width: 1366, height: 900 }],
  ['search-landscape-tablet', '/search?genre=mystery', { width: 1180, height: 820 }],
  ['search-portrait-tablet', '/search?q=holmes', { width: 820, height: 1180 }],
  ['book-desktop', '/books/mapleford', { width: 1366, height: 900 }],
  ['book-mobile', '/books/pride', { width: 390, height: 844 }],
  ['map-landscape', '/books/mapleford/locate', { width: 1180, height: 820 }],
  ['map-first-floor', '/books/godan/locate', { width: 1366, height: 900 }],
  ['handoff', '/handoff?to=%2Fbooks%2Fmapleford', { width: 820, height: 1180 }],
  ['member-signin', '/member', { width: 1366, height: 900 }],
  ['explore', '/explore', { width: 1180, height: 820 }],
];

for (const [name, path, viewport] of shots) {
  test(name, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
    await page.screenshot({ path: `test-results/screens/${name}.png`, fullPage: true });
  });
}

test('staff-overview', async ({ page }) => {
  await page.goto('/staff');
  await page.getByRole('button', { name: /Enter as librarian/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/screens/staff-overview.png', fullPage: true });
  await page.goto('/staff/desk?mode=checkout');
  await page.getByLabel('Find a member').fill('Noor');
  await page.getByRole('button', { name: /Noor Haddad/ }).click();
  await page.getByLabel('Copy barcode').fill('BB000101');
  await page.getByRole('button', { name: 'Look up' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/screens/staff-desk.png', fullPage: true });
});

test('member-dashboard', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/member');
  await page.getByLabel(/Card number/).fill('20010001');
  await page.getByLabel('PIN').fill('1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Hello, Asha' }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/screens/member-dashboard.png', fullPage: true });
});

test('staff-reservations', async ({ page }) => {
  await page.goto('/staff');
  await page.getByRole('button', { name: /Enter as librarian/ }).click();
  await page.goto('/staff/reservations');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/screens/staff-reservations.png', fullPage: true });
});
