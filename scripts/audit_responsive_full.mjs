import { chromium } from 'playwright';
import fs from 'fs';

const executablePath =
  process.env.PW_EXECUTABLE_PATH ||
  (process.platform === 'win32'
    ? 'C:\\Users\\Admin\\AppData\\Local\\ms-playwright\\chromium-1254\\chrome-win64\\chrome.exe'
    : undefined);

const viewports = [
  { name: 'small-mobile', width: 320, height: 640 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'iphone-se', width: 375, height: 812 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'large-mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'large-desktop-1920', width: 1920, height: 1080 },
];

const nav = [
  { id: 'overview', label: 'Overview', contains: 'Directional Acc.' },
  { id: 'exchange', label: 'Exchange Intel', contains: 'Exchange Intelligence Comparison' },
  { id: 'assets', label: 'Asset Rankings', contains: '0700.HK' },
  { id: 'social', label: 'Social Sentiment', contains: 'Social Sentiment' },
  { id: 'news', label: 'News Intelligence', contains: 'News Intelligence Discovery' },
  { id: 'predictions', label: 'Price Predictions', contains: 'Price Prediction Center' },
  { id: 'performance', label: 'Model Validation', contains: 'Model Validation' },
  { id: 'backtesting', label: 'Backtesting Lab', contains: 'Backtesting Lab' },
  { id: 'reports', label: 'Executive Reports', contains: 'Executive Reports' },
  { id: 'sources', label: 'Data Registry', contains: 'Data Registry' },
  { id: 'pipeline', label: 'Pipeline Monitor', contains: 'Autonomous Multi-Agent Orchestration Console' },
  { id: 'settings', label: 'Settings & Keys', contains: 'System Configuration & API Credentials' },
];

if (!fs.existsSync('test-screenshots')) fs.mkdirSync('test-screenshots', { recursive: true });

const results = [];

for (const vp of viewports) {
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  let viewportOk = true;
  let overflow = null;
  const sections = [];

  try {
    const resp = await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    if (resp.status() !== 200) viewportOk = false;
    await page.waitForTimeout(800);
    overflow = await page.evaluate(() => ({
      docWidth: document.documentElement.scrollWidth,
      winWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      hasOverflow:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.body.scrollWidth > window.innerWidth,
    }));
    if (overflow.hasOverflow) viewportOk = false;

    await page.screenshot({ path: `test-screenshots/resp_${vp.name}.png`, fullPage: false });

    const isMobile = vp.width < 1024;

    for (const n of nav) {
      try {
        if (isMobile) {
          const menu = page.locator('button[aria-label="Toggle navigation drawer"]');
          if ((await menu.count()) > 0 && !(await page.locator('aside').isVisible())) {
            await menu.click();
            await page.waitForTimeout(400);
          }
          const btn = page.locator('button', { hasText: n.label }).first();
          if ((await btn.count()) === 0) throw new Error(`nav button "${n.label}" not found in drawer`);
          await btn.click();
        } else {
          const btn = page.getByRole('button', { name: n.label, exact: true });
          if ((await btn.count()) === 0) throw new Error(`nav button "${n.label}" not found`);
          await btn.first().click();
        }

        await page.waitForFunction(
          (text) => document.body.innerText.includes(text),
          { timeout: 6000 },
          n.contains
        );

        const body = await page.locator('body').innerText();
        if (!body.includes(n.contains)) throw new Error(`missing expected content: ${n.contains}`);
        sections.push({ id: n.id, pass: true });
      } catch (e) {
        sections.push({ id: n.id, pass: false, error: String(e) });
        viewportOk = false;
      }
    }
  } catch (e) {
    viewportOk = false;
    console.error(`VIEWPORT_ERROR ${vp.name}`, e.message);
  }

  results.push({
    ...vp,
    overflow,
    pass: viewportOk,
    consoleErrors: consoleErrors.slice(0, 5),
    sections,
  });
  await browser.close();
}

fs.writeFileSync('test-screenshots/responsive_results.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
