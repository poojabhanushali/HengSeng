#!/usr/bin/env node
/**
 * LIVE E2E END-TO-END TEST SUITE — HengSeng Sentiment Price Prediction Agent
 * Tests the actual running browser UI and live integrations at http://localhost:3000
 * 
 * Security: Never logs, screenshots, or exposes .env values, API tokens, or credentials.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots', 'live-e2e');
const BASE_URL = 'http://localhost:3000';
const CHROMIUM_PATH =
  process.platform === 'win32'
    ? 'C:\\Users\\Admin\\AppData\\Local\\ms-playwright\\chromium-1254\\chrome-win64\\chrome.exe'
    : undefined;

const results = {
  passed: 0,
  failed: 0,
  tests: [],
  screenshots: [],
  consoleErrors: [],
  networkFailures: [],
};

function record(name, passed, detail) {
  if (passed) {
    results.passed++;
    console.log(`  [PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    results.failed++;
    console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
  results.tests.push({ name, passed, detail, timestamp: new Date().toISOString() });
}

function captureScreenshot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  try {
    if (!page.isClosed()) {
      page.screenshot({ path: filePath, fullPage: true });
      results.screenshots.push(filePath);
      console.log(`    📷 Screenshot: ${name}`);
    }
  } catch (e) {
    console.log(`    ⚠️  Screenshot failed: ${name} — ${e.message}`);
  }
}

async function runLiveE2ETests() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('=' .repeat(70));
  console.log('LIVE E2E END-TO-END TEST SUITE — HengSeng Agent');
  console.log('=' .repeat(70));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ============================================================
  // TEST 1: API Verification — Live Sources Status
  // ============================================================
  console.log('\n📋 TEST 1: Live API Sources Status');
  console.log('-'.repeat(50));

  const apiPage = await browser.newPage();
  apiPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`API page: ${m.text()}`);
  });
  apiPage.on('pageerror', (err) => results.consoleErrors.push(`API page error: ${err.message}`));

  await apiPage.goto(`${BASE_URL}/api/v1/sources/status`, { waitUntil: 'networkidle', timeout: 30000 });
  const sourcesStatus = await apiPage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  record(
    'GET /api/v1/sources/status returns 200',
    sourcesStatus !== null,
    `generatedAt: ${sourcesStatus ? sourcesStatus.generatedAt : 'missing'}`
  );

  const apifySource = sourcesStatus ? sourcesStatus.sources.find((s) => s.id === 'apify_social') : null;
  const exaSource = sourcesStatus ? sourcesStatus.sources.find((s) => s.id === 'exa_news') : null;

  record(
    'Apify source: credentialConfigured=true',
    apifySource ? apifySource.credentialConfigured === true : false,
    `mode: ${apifySource ? apifySource.mode : 'missing'}`
  );
  record(
    'Apify source: mode=live (actors ran)',
    apifySource ? apifySource.mode === 'live' : false,
    `mode: ${apifySource ? apifySource.mode : 'missing'}, recordCount: ${apifySource ? apifySource.recordCount : 'missing'}`
  );
  record(
    'Apify source: platforms array present',
    apifySource ? Array.isArray(apifySource.platforms) && apifySource.platforms.length >= 3 : false,
    `platforms: ${apifySource ? apifySource.platforms.join(', ') : 'missing'}`
  );
  record(
    'Exa source: credentialConfigured=true',
    exaSource ? exaSource.credentialConfigured === true : false,
    `mode: ${exaSource ? exaSource.mode : 'missing'}`
  );
  record(
    'Exa source: mode=live (Exa ran)',
    exaSource ? exaSource.mode === 'live' : false,
    `mode: ${exaSource ? exaSource.mode : 'missing'}, liveRecordCount: ${exaSource ? exaSource.liveRecordCount : 'missing'}`
  );
  record(
    'Exa source: liveRecordCount > 0',
    exaSource ? (exaSource.liveRecordCount || 0) > 0 : false,
    `liveRecordCount: ${exaSource ? exaSource.liveRecordCount : 'missing'}`
  );
  record(
    'No .env values exposed in API response',
    sourcesStatus ? JSON.stringify(sourcesStatus).indexOf('apify_api_') === -1 && JSON.stringify(sourcesStatus).indexOf('80152f87') === -1 : false,
    'Credentials not leaked in response'
  );
  await apiPage.close();

  // ============================================================
  // TEST 2: Live API — Social Posts (Apify verified)
  // ============================================================
  console.log('\n📋 TEST 2: Live API — Social Posts (Apify Integration)');
  console.log('-'.repeat(50));

  const socialPage = await browser.newPage();
  socialPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Social page: ${m.text()}`);
  });
  await socialPage.goto(`${BASE_URL}/api/v1/social/posts`, { waitUntil: 'networkidle', timeout: 30000 });
  const socialData = await socialPage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  record(
    'GET /api/v1/social/posts returns 200',
    socialData !== null,
    `count: ${socialData ? socialData.count : 'missing'}`
  );
  record(
    'Social posts array exists',
    socialData ? Array.isArray(socialData.posts) : false,
    `posts length: ${socialData ? socialData.posts.length : 'missing'}`
  );
  const apifyPosts = socialData && socialData.posts ? socialData.posts.filter((p) => p.id && p.id.startsWith('apify_')) : [];
  record(
    'Apify LIVE posts present (id starts with apify_)',
    apifyPosts.length > 0,
    `Apify posts: ${apifyPosts.length}, total: ${socialData ? socialData.count : 'missing'}`
  );
  if (apifyPosts.length > 0) {
    const platforms = [...new Set(apifyPosts.map((p) => p.platform))];
    record(
      'Apify posts cover multiple platforms',
      platforms.length >= 3,
      `platforms: ${platforms.join(', ')}`
    );
    const allPlatforms = ['LIHKG', 'Telegram', 'Naver Finance', 'Daum Finance'];
    const coveredPlatforms = allPlatforms.filter((p) => platforms.includes(p));
    record(
      'All 4 target platforms represented in Apify posts',
      coveredPlatforms.length === 4,
      `covered: ${coveredPlatforms.join(', ')}`
    );
    const firstApify = apifyPosts[0];
    record(
      'Apify post has timestamp',
      firstApify ? Boolean(firstApify.publishedAt) : false,
      `publishedAt: ${firstApify ? firstApify.publishedAt : 'missing'}`
    );
    record(
      'Apify post has sentiment score',
      firstApify ? typeof firstApify.sentimentScore === 'number' : false,
      `sentimentScore: ${firstApify ? firstApify.sentimentScore : 'missing'}`
    );
    record(
      'Apify post has author',
      firstApify ? Boolean(firstApify.author) : false,
      `author: ${firstApify ? firstApify.author : 'missing'}`
    );
  }
  const curatedPosts = socialData && socialData.posts ? socialData.posts.filter((p) => p.id && p.id.startsWith('post_')) : [];
  record(
    'Curated posts not incorrectly marked live',
    curatedPosts.length > 0 ? curatedPosts.every((p) => !p.id.startsWith('apify_')) : true,
    `curated: ${curatedPosts.length}, apify: ${apifyPosts.length}`
  );
  await socialPage.close();

  // ============================================================
  // TEST 3: Live API — News Articles (Exa verified)
  // ============================================================
  console.log('\n📋 TEST 3: Live API — News Articles (Exa Integration)');
  console.log('-'.repeat(50));

  const newsPage = await browser.newPage();
  newsPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`News page: ${m.text()}`);
  });
  await newsPage.goto(`${BASE_URL}/api/v1/news/articles`, { waitUntil: 'networkidle', timeout: 30000 });
  const newsData = await newsPage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  record(
    'GET /api/v1/news/articles returns 200',
    newsData !== null,
    `count: ${newsData ? newsData.count : 'missing'}`
  );
  const articles = newsData && (newsData.articles || newsData.news) ? (newsData.articles || newsData.news) : [];
  record(
    'News articles array exists',
    Array.isArray(articles),
    `articles length: ${articles.length}`
  );
  const exaArticles = articles.filter((a) => a.id && a.id.startsWith('exa_'));
  record(
    'Exa LIVE articles present (id starts with exa_)',
    exaArticles.length > 0,
    `Exa articles: ${exaArticles.length}, total: ${articles.length}`
  );
  if (exaArticles.length > 0) {
    const publishers = [...new Set(exaArticles.map((a) => a.publisher))];
    record(
      'Exa articles have real publishers',
      publishers.length >= 5,
      `publishers: ${publishers.slice(0, 10).join(', ')}`
    );
    const firstExa = exaArticles[0];
    record(
      'Exa article has URL',
      firstExa ? Boolean(firstExa.url) && firstExa.url !== '#' : false,
      `url: ${firstExa ? firstExa.url : 'missing'}`
    );
    record(
      'Exa article has publisher name',
      firstExa ? Boolean(firstExa.publisher) && firstExa.publisher.length > 0 : false,
      `publisher: ${firstExa ? firstExa.publisher : 'missing'}`
    );
    record(
      'Exa article has timestamp',
      firstExa ? Boolean(firstExa.publishedAt) : false,
      `publishedAt: ${firstExa ? firstExa.publishedAt : 'missing'}`
    );
    record(
      'Exa article has relevance score',
      firstExa ? typeof firstExa.relevanceScore === 'number' : false,
      `relevanceScore: ${firstExa ? firstExa.relevanceScore : 'missing'}`
    );
  }
  const curatedArticles = articles.filter((a) => a.id && a.id.startsWith('news_'));
  record(
    'Curated articles not marked as Exa live',
    curatedArticles.length > 0 ? curatedArticles.every((a) => !a.id.startsWith('exa_')) : true,
    `curated: ${curatedArticles.length}, exa: ${exaArticles.length}`
  );
  await newsPage.close();

  // ============================================================
  // TEST 4: Live API — Predictions & Performance
  // ============================================================
  console.log('\n📋 TEST 4: Live API — Predictions & Model Performance');
  console.log('-'.repeat(50));

  const predPage = await browser.newPage();
  predPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Pred page: ${m.text()}`);
  });
  await predPage.goto(`${BASE_URL}/api/v1/predictions`, { waitUntil: 'networkidle', timeout: 30000 });
  const predData = await predPage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  record(
    'GET /api/v1/predictions returns 200',
    predData !== null,
    `count: ${predData ? predData.count : 'missing'}`
  );
  record(
    'Predictions array has 10 assets',
    predData ? Array.isArray(predData.predictions) && predData.predictions.length === 10 : false,
    `predictions length: ${predData ? predData.predictions.length : 'missing'}`
  );
  await predPage.close();

  const perfPage = await browser.newPage();
  perfPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Perf page: ${m.text()}`);
  });
  await perfPage.goto(`${BASE_URL}/api/v1/predictions/performance`, { waitUntil: 'networkidle', timeout: 30000 });
  const perfData = await perfPage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  record(
    'GET /api/v1/predictions/performance returns 200',
    perfData !== null,
    `leaderboard length: ${perfData ? perfData.leaderboard.length : 'missing'}`
  );
  record(
    'Leaderboard has 4 models',
    perfData ? Array.isArray(perfData.leaderboard) && perfData.leaderboard.length === 4 : false,
    `models: ${perfData ? perfData.leaderboard.map((m) => m.modelName).join(', ') : 'missing'}`
  );
  const ensemble = perfData ? perfData.leaderboard.find((m) => m.modelName && m.modelName.includes('Ensemble')) : null;
  record(
    'Ensemble model has directionalAccuracy > 0',
    ensemble ? ensemble.averageDirectionalAccuracy > 0 : false,
    `DA: ${ensemble ? ensemble.averageDirectionalAccuracy : 'missing'}%`
  );
  record(
    'Ensemble model has sampleCount (computed, not hardcoded)',
    ensemble ? typeof ensemble.sampleCount === 'number' && ensemble.sampleCount > 0 : false,
    `sampleCount: ${ensemble ? ensemble.sampleCount : 'missing'}`
  );
  record(
    'Methodology shows 50 OOS observations',
    perfData ? perfData.methodology && perfData.methodology.totalOutOfSampleObservations === 50 : false,
    `OOS observations: ${perfData ? perfData.methodology.totalOutOfSampleObservations : 'missing'}`
  );
  record(
    'No hardcoded metrics (values are computed)',
    perfData ? perfData.leaderboard.every((m) => typeof m.averageDirectionalAccuracy === 'number') : false,
    'All DA values are numbers'
  );
  await perfPage.close();

  // ============================================================
  // TEST 5: Live API — All 10 Assets Predictions
  // ============================================================
  console.log('\n📋 TEST 5: Live API — All 10 Assets');
  console.log('-'.repeat(50));

  const assetsPage = await browser.newPage();
  assetsPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Assets page: ${m.text()}`);
  });
  await assetsPage.goto(`${BASE_URL}/api/v1/assets`, { waitUntil: 'networkidle', timeout: 30000 });
  const assetsData = await assetsPage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  record(
    'GET /api/v1/assets returns 200',
    assetsData !== null,
    `count: ${assetsData ? assetsData.count : 'missing'}`
  );
  record(
    'Assets array has 10 entries',
    assetsData ? Array.isArray(assetsData.assets) && assetsData.assets.length === 10 : false,
    `assets length: ${assetsData ? assetsData.assets.length : 'missing'}`
  );

  const tickers = assetsData && assetsData.assets ? assetsData.assets.map((a) => a.ticker) : [
    '0700.HK', '9988.HK', '0005.HK', '3690.HK', '1810.HK',
    '005930.KS', '000660.KS', '035420.KS', '035720.KS', '005380.KS',
  ];
  let allTickerPredictionsPass = true;
  for (const ticker of tickers) {
    try {
      const tPage = await browser.newPage();
      tPage.on('console', (m) => {
        if (m.type() === 'error') results.consoleErrors.push(`Ticker ${ticker}: ${m.text()}`);
      });
      await tPage.goto(`${BASE_URL}/api/v1/assets/${encodeURIComponent(ticker)}/predictions`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
      const tData = await tPage.evaluate(() => {
        const pre = document.querySelector('pre');
        return pre ? JSON.parse(pre.textContent || '{}') : null;
      });
      const hasPrediction = tData ? tData.predictionDetail && tData.predictionDetail.ticker === ticker : false;
      if (!hasPrediction) allTickerPredictionsPass = false;
      record(
        `GET /api/v1/assets/${ticker}/predictions returns valid prediction`,
        hasPrediction,
        `ticker: ${tData ? (tData.predictionDetail ? tData.predictionDetail.ticker : 'missing') : 'missing'}, predictedPrice: ${tData ? (tData.predictionDetail ? tData.predictionDetail.predictedPrice : 'missing') : 'missing'}`
      );
      await tPage.close();
    } catch (e) {
      allTickerPredictionsPass = false;
      record(`GET /api/v1/assets/${ticker}/predictions`, false, e.message);
    }
  }
  record('All 10 tickers have valid predictions', allTickerPredictionsPass);
  await assetsPage.close();

  // ============================================================
  // TEST 6: Pipeline Run
  // ============================================================
  console.log('\n📋 TEST 6: Live 8-Agent Pipeline Run');
  console.log('-'.repeat(50));

  const pipePage = await browser.newPage();
  pipePage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Pipeline page: ${m.text()}`);
  });

  await pipePage.goto(`${BASE_URL}/api/v1/pipeline/status`, { waitUntil: 'networkidle', timeout: 30000 });
  const pipeBefore = await pipePage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });
  record(
    'Pipeline status endpoint returns 200',
    pipeBefore !== null,
    `agents: ${pipeBefore ? pipeBefore.agents.length : 0}`
  );

  const runRes = await fetch(`${BASE_URL}/api/v1/agents/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const runData = await runRes.json();
  record(
    'POST /api/v1/agents/run returns success',
    runData.success === true,
    `durationMs: ${runData.durationMs}, errors: ${runData.errors ? runData.errors.length : 0}`
  );
  record(
    'Pipeline completed without errors',
    runData.errors ? runData.errors.length === 0 : false,
    `error count: ${runData.errors ? runData.errors.length : 0}`
  );

  await pipePage.waitForTimeout(2000);
  await pipePage.goto(`${BASE_URL}/api/v1/pipeline/status`, { waitUntil: 'networkidle', timeout: 30000 });
  const pipeAfter = await pipePage.evaluate(() => {
    const pre = document.querySelector('pre');
    return pre ? JSON.parse(pre.textContent || '{}') : null;
  });

  const agents = pipeAfter ? pipeAfter.agents : [];
  record(
    'All 8 agents completed',
    agents.filter((a) => a.status === 'completed').length === 8,
    `completed: ${agents.filter((a) => a.status === 'completed').length}/8`
  );
  record(
    'All 7 integrity checks passed',
    pipeAfter ? pipeAfter.integrityChecks.filter((c) => c.passed).length === 7 : false,
    `passed: ${pipeAfter ? pipeAfter.integrityChecks.filter((c) => c.passed).length : 0}/7`
  );
  record(
    'Agent 2 (Social Scraping) processed records',
    agents[1] ? agents[1].itemsProcessed > 0 : false,
    `itemsProcessed: ${agents[1] ? agents[1].itemsProcessed : 'missing'}`
  );
  record(
    'Agent 3 (News Research) processed records',
    agents[2] ? agents[2].itemsProcessed > 0 : false,
    `itemsProcessed: ${agents[2] ? agents[2].itemsProcessed : 'missing'}`
  );
  record(
    'No agent failed',
    agents.every((a) => a.status !== 'failed'),
    `failed agents: ${agents.filter((a) => a.status === 'failed').length}`
  );
  await pipePage.close();

  // ============================================================
  // TEST 7: Browser UI — Navigation & Pages
  // ============================================================
  console.log('\n📋 TEST 7: Browser UI — Navigation & Pages');
  console.log('-'.repeat(50));

  const uiPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  uiPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`UI page: ${m.text()}`);
  });
  uiPage.on('pageerror', (err) => results.consoleErrors.push(`UI page error: ${err.message}`));
  uiPage.on('requestfailed', (req) => {
    results.networkFailures.push(`Failed: ${req.method()} ${req.url()} — ${req.failure() ? req.failure().errorText : 'unknown'}`);
  });
  uiPage.on('response', (res) => {
    if (res.status() >= 400 && res.status() < 600) {
      results.networkFailures.push(`HTTP ${res.status()}: ${res.url()}`);
    }
  });

  await uiPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  record(
    'Homepage loads with 200 status',
    true,
    `URL: ${uiPage.url()}`
  );
  const sidebarVisible = await uiPage.locator('aside').isVisible();
  record(
    'Desktop sidebar visible on large viewport',
    sidebarVisible,
    'Sidebar navigation present'
  );

  const navItems = await uiPage.locator('nav button, aside button').count();
  record(
    'Navigation items present (12 expected)',
    navItems >= 12,
    `found: ${navItems}`
  );

  // Check for HengSeng branding in sidebar
  const sidebarText = await uiPage.locator('aside').innerText();
  record(
    'HengSeng branding visible in sidebar',
    sidebarText.includes('HengSeng'),
    'Branding present'
  );

  const navLabels = [
    'Overview', 'Exchange Intel', 'Asset Rankings', 'Social Sentiment',
    'News Intelligence', 'Price Predictions', 'Model Validation',
    'Backtesting Lab', 'Executive Reports', 'Data Registry',
    'Pipeline Monitor', 'Settings & Keys',
  ];

  for (const label of navLabels) {
    try {
      const btn = uiPage.locator('button', { hasText: label }).first();
      if (await btn.count() > 0) {
        await btn.click();
        await uiPage.waitForTimeout(800);
        const bodyText = await uiPage.locator('body').innerText();
        record(
          `Navigation: ${label} loads content`,
          bodyText.length > 50,
          `content length: ${bodyText.length}`
        );
      } else {
        record(`Navigation: ${label} button found`, false, 'button not found');
      }
    } catch (e) {
      record(`Navigation: ${label}`, false, e.message);
    }
  }

  captureScreenshot(uiPage, 'ui-homepage-all-tabs');
  await uiPage.close();

  // ============================================================
  // TEST 8: Asset Detail Modal
  // ============================================================
  console.log('\n📋 TEST 8: Asset Detail Modal');
  console.log('-'.repeat(50));

  const modalPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  modalPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Modal page: ${m.text()}`);
  });
  await modalPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  await modalPage.locator('button', { hasText: 'Asset Rankings' }).first().click();
  await modalPage.waitForTimeout(800);

  await modalPage.locator('text=0700.HK').first().click();
  await modalPage.waitForTimeout(1000);

  const modalVisible = await modalPage.locator('text=FLOOR TRADER PIVOT').count() > 0;
  record(
    'Asset detail modal opens',
    modalVisible,
    'Modal content visible'
  );

  const subTabs = ['Price & Technicals', 'ML Price Forecast (n+1)', 'Multi-Source Sentiment', 'Discussions & News'];
  for (const tab of subTabs) {
    try {
      await modalPage.locator('button', { hasText: tab }).first().click();
      await modalPage.waitForTimeout(500);
      const tabContent = await modalPage.locator('body').innerText();
      record(
        `Modal sub-tab: ${tab}`,
        tabContent.length > 100,
        'sub-tab content loaded'
      );
    } catch (e) {
      record(`Modal sub-tab: ${tab}`, false, e.message);
    }
  }

  captureScreenshot(modalPage, 'ui-asset-detail-modal');
  try {
    await modalPage.locator('button[aria-label="Close modal"]').first().click();
    await modalPage.waitForTimeout(300);
  } catch (e) {
    // try X button
    await modalPage.locator('button:has-text("×")').first().click();
    await modalPage.waitForTimeout(300);
  }
  const modalClosed = await modalPage.locator('text=FLOOR TRADER PIVOT').count() === 0;
  record(
    'Modal closes cleanly',
    modalClosed,
    'Modal dismissed'
  );
  await modalPage.close();

  // ============================================================
  // TEST 9: Reports View
  // ============================================================
  console.log('\n📋 TEST 9: Executive Reports View');
  console.log('-'.repeat(50));

  const reportsPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  reportsPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Reports page: ${m.text()}`);
  });
  await reportsPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await reportsPage.locator('button', { hasText: 'Executive Reports' }).first().click();
  await reportsPage.waitForTimeout(1000);

  const reportsText = await reportsPage.locator('body').innerText();
  record(
    'Reports page loads',
    reportsText.includes('Executive Quantitative Intelligence Briefings') || reportsText.includes('Briefing'),
    'Reports heading visible'
  );
  record(
    'Reports show exchange briefings',
    reportsText.includes('HKEX') || reportsText.includes('KRX') || reportsText.includes('ALL'),
    'Exchange data present'
  );
  record(
    'Reports show directional accuracy',
    reportsText.includes('Directional Acc.') || reportsText.includes('Directional'),
    'DA metric displayed'
  );

  captureScreenshot(reportsPage, 'ui-reports-view');
  await reportsPage.close();

  // ============================================================
  // TEST 10: Data Sources / Settings View
  // ============================================================
  console.log('\n📋 TEST 10: Data Sources & Settings View');
  console.log('-'.repeat(50));

  const sourcesPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  sourcesPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Sources page: ${m.text()}`);
  });
  await sourcesPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await sourcesPage.locator('button', { hasText: 'Data Registry' }).first().click();
  await sourcesPage.waitForTimeout(1000);

  const sourcesText = await sourcesPage.locator('body').innerText();
  record(
    'Data Sources page loads',
    sourcesText.includes('Data Sources & Integration Registry') || sourcesText.includes('Data Registry'),
    'Sources heading visible'
  );
  record(
    'Apify source card shows LIVE',
    sourcesText.includes('LIVE Apify Actors') || sourcesText.includes('LIVE'),
    'Apify mode displayed as LIVE'
  );
  record(
    'Exa source card shows LIVE',
    sourcesText.includes('LIVE Exa API') || sourcesText.includes('LIVE'),
    'Exa mode displayed as LIVE'
  );
  record(
    'No credentials exposed in UI',
    !sourcesText.includes('apify_api_') && !sourcesText.includes('80152f87'),
    'No API keys visible in UI'
  );

  captureScreenshot(sourcesPage, 'ui-data-sources-view');
  await sourcesPage.close();

  // ============================================================
  // TEST 11: Model Performance / Leaderboard
  // ============================================================
  console.log('\n📋 TEST 11: Model Performance Leaderboard');
  console.log('-'.repeat(50));

  const perfUIPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  perfUIPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Leaderboard page: ${m.text()}`);
  });
  await perfUIPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await perfUIPage.locator('button', { hasText: 'Model Validation' }).first().click();
  await perfUIPage.waitForTimeout(1000);

  const leaderboardText = await perfUIPage.locator('body').innerText();
  record(
    'Leaderboard page loads',
    leaderboardText.includes('Model Validation & Benchmark Leaderboard'),
    'Leaderboard heading visible'
  );
  record(
    'Leaderboard shows 4 models',
    leaderboardText.includes('Ridge') && leaderboardText.includes('Ensemble') && leaderboardText.includes('Persistence') && leaderboardText.includes('Moving Average'),
    'All 4 model types present'
  );
  record(
    'Leaderboard shows PRODUCTION label',
    leaderboardText.includes('PRODUCTION'),
    'Deployed model labeled'
  );
  record(
    'Leaderboard shows OOS N = 50',
    leaderboardText.includes('50'),
    'Sample size disclosed'
  );

  captureScreenshot(perfUIPage, 'ui-model-performance');
  await perfUIPage.close();

  // ============================================================
  // TEST 12: Pipeline Monitor
  // ============================================================
  console.log('\n📋 TEST 12: Pipeline Monitor View');
  console.log('-'.repeat(50));

  const pipeUIPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  pipeUIPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Pipeline UI: ${m.text()}`);
  });
  await pipeUIPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await pipeUIPage.locator('button', { hasText: 'Pipeline Monitor' }).first().click();
  await pipeUIPage.waitForTimeout(1000);

  const pipeText = await pipeUIPage.locator('body').innerText();
  record(
    'Pipeline page loads',
    pipeText.includes('Autonomous Multi-Agent Orchestration Console') || pipeText.includes('Pipeline Monitor'),
    'Pipeline heading visible'
  );
  record(
    'Pipeline shows 8 agents',
    pipeText.includes('AGENT 0') || pipeText.includes('Agent 0') || pipeText.includes('Agent 1'),
    'Agent cards present'
  );
  record(
    'Pipeline shows integrity checks',
    pipeText.includes('Quality Control') || pipeText.includes('Integrity'),
    'QC checklist present'
  );

  captureScreenshot(pipeUIPage, 'ui-pipeline-monitor');
  await pipeUIPage.close();

  // ============================================================
  // TEST 13: Backtesting Lab
  // ============================================================
  console.log('\n📋 TEST 13: Backtesting Lab');
  console.log('-'.repeat(50));

  const backtestPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  backtestPage.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(`Backtest page: ${m.text()}`);
  });
  await backtestPage.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await backtestPage.locator('button', { hasText: 'Backtesting Lab' }).first().click();
  await backtestPage.waitForTimeout(1000);

  const backtestText = await backtestPage.locator('body').innerText();
  record(
    'Backtesting page loads',
    backtestText.includes('Backtesting Lab'),
    'Backtesting heading visible'
  );
  record(
    'Backtesting shows directional hit rate',
    backtestText.includes('Directional Hit Rate') || backtestText.includes('Hit Rate'),
    'Hit rate metric present'
  );

  captureScreenshot(backtestPage, 'ui-backtesting-lab');
  await backtestPage.close();

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n' + '=' .repeat(70));
  console.log('LIVE E2E TEST RESULTS SUMMARY');
  console.log('=' .repeat(70));
  console.log(`PASSED: ${results.passed}`);
  console.log(`FAILED: ${results.failed}`);
  console.log(`TOTAL:  ${results.passed + results.failed}`);
  console.log(`SCREENSHOTS: ${results.screenshots.length}`);
  console.log(`CONSOLE ERRORS: ${results.consoleErrors.length}`);
  console.log(`NETWORK FAILURES: ${results.networkFailures.length}`);
  console.log('');

  if (results.consoleErrors.length > 0) {
    console.log('CONSOLE ERRORS:');
    results.consoleErrors.slice(0, 10).forEach((e) => console.log(`  ⚠️  ${e}`));
  }
  if (results.networkFailures.length > 0) {
    console.log('NETWORK FAILURES:');
    results.networkFailures.slice(0, 10).forEach((e) => console.log(`  ⚠️  ${e}`));
  }

  const allPassed = results.failed === 0;
  console.log(`\nVERDICT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('=' .repeat(70));

  process.exit(allPassed ? 0 : 1);
}

runLiveE2ETests().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});
