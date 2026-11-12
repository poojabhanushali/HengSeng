const { chromium } = require('playwright');
const fs = require('fs');

async function runResponsiveAudit() {
  if (!fs.existsSync('test-screenshots')) fs.mkdirSync('test-screenshots');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

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
    { name: 'large-desktop-1920', width: 1920, height: 1080 }
  ];

  console.log('--- INDEPENDENT PLAYWRIGHT RESPONSIVE AUDIT ---');
  const results = [];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    // Measure document vs viewport width to check for horizontal overflow
    const overflowMetrics = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const windowWidth = window.innerWidth;
      const bodyWidth = document.body.scrollWidth;
      return {
        docWidth,
        windowWidth,
        bodyWidth,
        hasHorizontalOverflow: docWidth > windowWidth || bodyWidth > windowWidth
      };
    });

    const screenshotPath = `test-screenshots/${vp.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Test mobile drawer if on mobile (< 1024px)
    let drawerWorks = true;
    if (vp.width < 1024) {
      const menuBtn = await page.locator('button[aria-label="Toggle navigation drawer"]');
      const isVisible = await menuBtn.isVisible();
      if (isVisible) {
        await menuBtn.click();
        await page.waitForTimeout(150);
        const drawer = await page.locator('aside');
        drawerWorks = (await drawer.count()) > 0;
        // Close drawer
        const closeBtn = await page.locator('button[aria-label="Close navigation drawer"]');
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await page.waitForTimeout(100);
        }
      } else {
        drawerWorks = false;
      }
    }

    const passed = !overflowMetrics.hasHorizontalOverflow && drawerWorks;
    results.push({
      ...vp,
      ...overflowMetrics,
      drawerWorks,
      passed
    });

    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${vp.name} (${vp.width}x${vp.height}): overflow=${overflowMetrics.hasHorizontalOverflow}, drawer=${drawerWorks}`);
    await page.close();
  }

  // Test functional modal interaction on desktop
  const testPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await testPage.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Click on first asset in Asset Explorer
  await testPage.locator('button:has-text("Asset Rankings")').click();
  await testPage.waitForTimeout(200);
  await testPage.locator('text=0700.HK').first().click();
  await testPage.waitForTimeout(300);
  const modalVisible = (await testPage.locator('text=FLOOR TRADER PIVOT').count()) > 0;
  console.log('Modal deep-dive opened:', modalVisible);
  await testPage.locator('button[aria-label="Close modal"]:visible').first().click();
  await testPage.waitForTimeout(200);
  const modalClosed = (await testPage.locator('text=FLOOR TRADER PIVOT').count()) === 0;
  console.log('Modal closed cleanly:', modalClosed);

  await testPage.close();
  await browser.close();

  const allPassed = results.every(r => r.passed) && modalVisible && modalClosed;
  console.log(`\nOverall Responsive & Interactive Result: ${allPassed ? 'ALL 10 VIEWPORTS PASSED' : 'DEFECTS FOUND'}`);
  process.exit(allPassed ? 0 : 1);
}

runResponsiveAudit().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
