import { test, expect, chromium, devices } from '@playwright/test';

test.use({ baseURL: 'http://localhost:3000' });

test.describe('API contracts (no browser rendering)', () => {
  test('health endpoint returns healthy', async ({ request }) => {
    const res = await request.get('/api/v1/health');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.status).toBe('healthy');
    expect(json.monitoredAssets).toBe(10);
  });

  test('assets endpoint returns 10 assets', async ({ request }) => {
    const res = await request.get('/api/v1/assets');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(json.count).toBe(10);
  });

  test('predictions performance returns leaderboard', async ({ request }) => {
    const res = await request.get('/api/v1/predictions/performance');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.leaderboard)).toBe(true);
    expect(json.leaderboard.length).toBeGreaterThanOrEqual(4);
  });

  test('sources status classifies live vs fallback', async ({ request }) => {
    const res = await request.get('/api/v1/sources/status');
    expect(res.ok()).toBe(true);
    const json = await res.json();
    expect(Array.isArray(json.sources)).toBe(true);
  });

  test('protected mutation rejects unauthenticated', async ({ request }) => {
    const res = await request.post('/api/v1/agents/run');
    expect(res.status()).toBe(401);
  });
});

test.describe('Authentication & navigation (real browser)', () => {
  test('login page renders and sign in reaches the app', async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto('/');
      await page.waitForTimeout(1500);
      const userInput = page.locator('input[placeholder="Username"]');
      if (await userInput.isVisible().catch(() => false)) {
        await page.fill('input[placeholder="Username"]', 'admin');
        await page.fill('input[placeholder="••••••••"]', 'admin123');
        await page.click('button:has-text("Sign in")');
        await page.waitForTimeout(1500);
      }
      // App shell should be present after login
      const shell = page.locator('text=HengSeng Agent').or(page.locator('text=HengSeng'));
      await expect(shell).toBeVisible({ timeout: 5000 });
    } finally {
      await browser.close();
    }
  });

  test('mobile viewport renders navigation drawer toggle', async () => {
    const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] });
    const context = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await page.waitForTimeout(1500);
      const hamburger = page.locator('button[aria-label="Toggle navigation drawer"]');
      await expect(hamburger).toBeVisible({ timeout: 5000 });
    } finally {
      await browser.close();
    }
  });
});
