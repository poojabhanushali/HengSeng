# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\app.spec.ts >> Authentication & navigation (real browser) >> login page renders and sign in reaches the app
- Location: tests\e2e\app.spec.ts:43:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> C:\Users\Admin\AppData\Local\ms-playwright\chromium_headless_shell-1254\chrome-headless-shell-win64\chrome-headless-shell.exe --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface,SkipListAccountsWithoutGaiaCookies --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --enable-unsafe-swiftshader --edge-skip-compat-layer-relaunch --disable-stack-profiler --disable-infobars --disable-sync --do-not-de-elevate --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-sandbox --disable-gpu --disable-dev-shm-usage --single-process --no-zygote --user-data-dir=C:\Users\Admin\AppData\Local\Temp\playwright_chromiumdev_profile-dO5tr5 --remote-debugging-pipe --no-startup-window
<launched> pid=8540
[pid=8540][err] [1113/132943.376:FATAL:gin\v8_initializer.cc:642] Error loading V8 startup snapshot file
Call log:
  - <launching> C:\Users\Admin\AppData\Local\ms-playwright\chromium_headless_shell-1254\chrome-headless-shell-win64\chrome-headless-shell.exe --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface,SkipListAccountsWithoutGaiaCookies --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --enable-unsafe-swiftshader --edge-skip-compat-layer-relaunch --disable-stack-profiler --disable-infobars --disable-sync --do-not-de-elevate --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-sandbox --disable-gpu --disable-dev-shm-usage --single-process --no-zygote --user-data-dir=C:\Users\Admin\AppData\Local\Temp\playwright_chromiumdev_profile-dO5tr5 --remote-debugging-pipe --no-startup-window
  - <launched> pid=8540
  - [pid=8540][err] [1113/132943.376:FATAL:gin\v8_initializer.cc:642] Error loading V8 startup snapshot file
  - [pid=8540] <gracefully close start>
  - [pid=8540] <kill>
  - [pid=8540] <will force kill>
  - [pid=8540] <process did exit: exitCode=2147483651, signal=null>
  - [pid=8540] starting temporary directories cleanup
  - [pid=8540] finished temporary directories cleanup
  - [pid=8540] <gracefully close end>

```

# Test source

```ts
  1  | import { test, expect, chromium, devices } from '@playwright/test';
  2  | 
  3  | test.use({ baseURL: 'http://localhost:3000' });
  4  | 
  5  | test.describe('API contracts (no browser rendering)', () => {
  6  |   test('health endpoint returns healthy', async ({ request }) => {
  7  |     const res = await request.get('/api/v1/health');
  8  |     expect(res.ok()).toBe(true);
  9  |     const json = await res.json();
  10 |     expect(json.status).toBe('healthy');
  11 |     expect(json.monitoredAssets).toBe(10);
  12 |   });
  13 | 
  14 |   test('assets endpoint returns 10 assets', async ({ request }) => {
  15 |     const res = await request.get('/api/v1/assets');
  16 |     expect(res.ok()).toBe(true);
  17 |     const json = await res.json();
  18 |     expect(json.count).toBe(10);
  19 |   });
  20 | 
  21 |   test('predictions performance returns leaderboard', async ({ request }) => {
  22 |     const res = await request.get('/api/v1/predictions/performance');
  23 |     expect(res.ok()).toBe(true);
  24 |     const json = await res.json();
  25 |     expect(Array.isArray(json.leaderboard)).toBe(true);
  26 |     expect(json.leaderboard.length).toBeGreaterThanOrEqual(4);
  27 |   });
  28 | 
  29 |   test('sources status classifies live vs fallback', async ({ request }) => {
  30 |     const res = await request.get('/api/v1/sources/status');
  31 |     expect(res.ok()).toBe(true);
  32 |     const json = await res.json();
  33 |     expect(Array.isArray(json.sources)).toBe(true);
  34 |   });
  35 | 
  36 |   test('protected mutation rejects unauthenticated', async ({ request }) => {
  37 |     const res = await request.post('/api/v1/agents/run');
  38 |     expect(res.status()).toBe(401);
  39 |   });
  40 | });
  41 | 
  42 | test.describe('Authentication & navigation (real browser)', () => {
  43 |   test('login page renders and sign in reaches the app', async () => {
> 44 |     const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] });
     |                                    ^ Error: browserType.launch: Target page, context or browser has been closed
  45 |     const context = await browser.newContext();
  46 |     const page = await context.newPage();
  47 |     try {
  48 |       await page.goto('/');
  49 |       await page.waitForTimeout(1500);
  50 |       const userInput = page.locator('input[placeholder="Username"]');
  51 |       if (await userInput.isVisible().catch(() => false)) {
  52 |         await page.fill('input[placeholder="Username"]', 'admin');
  53 |         await page.fill('input[placeholder="••••••••"]', 'admin123');
  54 |         await page.click('button:has-text("Sign in")');
  55 |         await page.waitForTimeout(1500);
  56 |       }
  57 |       // App shell should be present after login
  58 |       const shell = page.locator('text=HengSeng Agent').or(page.locator('text=HengSeng'));
  59 |       await expect(shell).toBeVisible({ timeout: 5000 });
  60 |     } finally {
  61 |       await browser.close();
  62 |     }
  63 |   });
  64 | 
  65 |   test('mobile viewport renders navigation drawer toggle', async () => {
  66 |     const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--single-process', '--no-zygote'] });
  67 |     const context = await browser.newContext({ ...devices['Pixel 5'] });
  68 |     const page = await context.newPage();
  69 |     try {
  70 |       await page.goto('/');
  71 |       await page.waitForTimeout(1500);
  72 |       const hamburger = page.locator('button[aria-label="Toggle navigation drawer"]');
  73 |       await expect(hamburger).toBeVisible({ timeout: 5000 });
  74 |     } finally {
  75 |       await browser.close();
  76 |     }
  77 |   });
  78 | });
  79 | 
```