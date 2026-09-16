import { expect, test } from '@playwright/test';
import { ADMIN, DEMO_PASSWORD } from './settings.mjs';

// Signs in as each seeded role and opens every page in that role's sidebar, plus a thesis and a
// submission. A page fails if it crashes, logs an error, gets a server error, or scrolls sideways
// on a phone. The API tests check behaviour; this catches pages that break while drawing.

const ROLES = [
  {
    role: 'student',
    email: 'ana.cruz@tms.edu',
    password: DEMO_PASSWORD,
    pages: ['/', '/thesis', '/schedule', '/profile'],
    detailFrom: { page: '/thesis', link: 'a[href^="/submissions/"]' },
  },
  {
    role: 'adviser',
    email: 'maria.santos@tms.edu',
    password: DEMO_PASSWORD,
    pages: ['/', '/theses', '/schedule', '/profile'],
    detailFrom: { page: '/theses', link: 'td a[href^="/theses/"]' },
  },
  {
    role: 'admin',
    email: ADMIN.email,
    password: ADMIN.password,
    pages: ['/', '/theses', '/schedule', '/users', '/terms', '/audit', '/profile'],
    detailFrom: { page: '/theses', link: 'td a[href^="/theses/"]' },
  },
];

// Collects everything that should fail a page, for the page's whole life
function watchForProblems(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`Crash: ${error.message}`));
  page.on('console', (message) => {
    // The browser also logs expected 4xx API answers as "Failed to load resource"; server errors
    // are caught from the responses below instead
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      problems.push(`Console error: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`Server error ${response.status()}: ${response.url()}`);
  });
  return problems;
}

async function signIn(page, { email, password }) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

async function expectPageDrawn(page, path, problems, isMobile) {
  // Lazy-loaded pages show a loader first; wait for requests to settle, then for a heading
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading').first(), `${path} shows a heading`).toBeVisible();
  await expect(page.getByText('Something went wrong on this page'), `${path} did not crash`).toHaveCount(0);

  if (isMobile) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways by ${overflow}px on a phone`).toBeLessThanOrEqual(1);
  }
  expect(problems, `${path} had no errors`).toEqual([]);
}

for (const account of ROLES) {
  test(`${account.role}: every page draws without errors`, async ({ page }, testInfo) => {
    const isMobile = testInfo.project.name === 'phone';
    const problems = watchForProblems(page);
    await signIn(page, account);

    for (const path of account.pages) {
      await test.step(path, async () => {
        await page.goto(path);
        await expectPageDrawn(page, path, problems, isMobile);
      });
    }

    await test.step(`a detail page opened from ${account.detailFrom.page}`, async () => {
      await page.goto(account.detailFrom.page);
      await page.waitForLoadState('networkidle');
      const link = page.locator(account.detailFrom.link).first();
      const href = await link.getAttribute('href');
      await page.goto(href);
      await expectPageDrawn(page, href, problems, isMobile);
    });
  });
}

test('the sign-in page draws and refuses a wrong password', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill('ana.cruz@tms.edu');
  await page.getByLabel('Password', { exact: true }).fill('not-the-password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid|incorrect/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  expect(problems).toEqual([]);
});
