/**
 * INDEPENDENT VERIFICATION SUITE: All Backend API Endpoints (24 Checks)
 * Executes against live backend running on port 3000.
 */

const http = require('http');

const endpoints = [
  { method: 'GET', path: '/api/v1/health', validate: d => d.status === 'healthy' && d.monitoredAssets === 10 },
  { method: 'GET', path: '/api/v1/exchanges', validate: d => Array.isArray(d.exchanges) && d.exchanges.length === 2 },
  { method: 'GET', path: '/api/v1/exchanges/HKEX/overview', validate: d => d.exchange === 'HKEX' && d.assets.length === 5 },
  { method: 'GET', path: '/api/v1/exchanges/KRX/overview', validate: d => d.exchange === 'KRX' && d.assets.length === 5 },
  { method: 'GET', path: '/api/v1/assets', validate: d => Array.isArray(d.assets) && d.count === 10 },
  { method: 'GET', path: '/api/v1/assets?exchange=HKEX', validate: d => d.assets.every(a => a.exchange === 'HKEX') },
  { method: 'GET', path: '/api/v1/assets?exchange=KRX', validate: d => d.assets.every(a => a.exchange === 'KRX') },
  { method: 'GET', path: '/api/v1/assets/0700.HK', validate: d => d.ticker === '0700.HK' && d.exchange === 'HKEX' },
  { method: 'GET', path: '/api/v1/assets/005930.KS', validate: d => d.ticker === '005930.KS' && d.exchange === 'KRX' },
  { method: 'GET', path: '/api/v1/assets/0700.HK/prices', validate: d => Array.isArray(d.bars) && d.bars.length > 5 },
  { method: 'GET', path: '/api/v1/assets/0700.HK/predictions', validate: d => d && d.predictionDetail && d.predictionDetail.ticker === '0700.HK' },
  { method: 'GET', path: '/api/v1/assets/0700.HK/sentiment', validate: d => d.ticker === '0700.HK' && Array.isArray(d.recentPosts) },
  { method: 'GET', path: '/api/v1/social/posts', validate: d => Array.isArray(d.posts) && d.count > 0 },
  { method: 'GET', path: '/api/v1/social/posts?exchange=HKEX', validate: d => d.posts.every(p => p.exchange === 'HKEX') },
  { method: 'GET', path: '/api/v1/social/posts?exchange=KRX', validate: d => d.posts.every(p => p.exchange === 'KRX') },
  { method: 'GET', path: '/api/v1/social/summary', validate: d => d.totalPosts > 0 && d.averageSentiment !== undefined },
  { method: 'GET', path: '/api/v1/news/articles', validate: d => Array.isArray(d.articles) && d.totalCount > 0 },
  { method: 'GET', path: '/api/v1/news/articles?exchange=HKEX', validate: d => d.articles.every(a => a.exchange === 'HKEX') },
  { method: 'GET', path: '/api/v1/news/articles?exchange=KRX', validate: d => d.articles.every(a => a.exchange === 'KRX') },
  { method: 'GET', path: '/api/v1/news/summary', validate: d => d.totalArticles > 0 && d.publisherBreakdown !== undefined },
  { method: 'GET', path: '/api/v1/predictions', validate: d => Array.isArray(d.predictions) && d.count === 10 },
  { method: 'GET', path: '/api/v1/predictions/performance', validate: d => Array.isArray(d.leaderboard) && d.leaderboard.length >= 4 },
  { method: 'GET', path: '/api/v1/predictions/backtesting?ticker=0700.HK', validate: d => d.ticker === '0700.HK' && Array.isArray(d.backtestPoints) },
  { method: 'GET', path: '/api/v1/pipeline/status', validate: d => Array.isArray(d.agents) && d.agents.length === 8 }
];

let adminToken = null;

async function authenticate() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username: 'admin', password: 'admin123' });
    const req = http.request({
      hostname: 'localhost', port: 3000, path: '/api/v1/auth/login', method: 'POST', timeout: 5000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { adminToken = JSON.parse(data).accessToken || null; } catch { adminToken = null; }
        resolve();
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function request(method, path) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const headers = { 'Content-Type': 'application/json' };
    if (adminToken) headers.Authorization = 'Bearer ' + adminToken;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      timeout: 5000,
      headers,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const latency = Date.now() - t0;
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, latency });
        } catch (e) {
          resolve({ status: res.statusCode, data, latency, parseError: true });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function runAudit() {
  try { await authenticate(); } catch (e) { console.log('[WARN] Auth failed, running unauthenticated:', e.message); }
  console.log('--- INDEPENDENT LIVE API ENDPOINT VERIFICATION ---');
  let passed = 0;
  let failed = 0;
  const auditResults = [];

  for (const ep of endpoints) {
    try {
      const res = await request(ep.method, ep.path);
      const isStatusOk = res.status === 200;
      const isSchemaOk = !res.parseError && ep.validate(res.data);
      const ok = isStatusOk && isSchemaOk;

      if (ok) {
        passed++;
        console.log(`[PASS] ${ep.method} ${ep.path} -> HTTP ${res.status} (${res.latency}ms)`);
      } else {
        failed++;
        console.log(`[FAIL] ${ep.method} ${ep.path} -> HTTP ${res.status} (Schema Valid: ${isSchemaOk})`);
      }

      auditResults.push({
        method: ep.method,
        path: ep.path,
        status: res.status,
        latency: res.latency,
        passed: ok
      });
    } catch (err) {
      failed++;
      console.log(`[FAIL] ${ep.method} ${ep.path} -> Error: ${err.message}`);
    }
  }

  console.log(`\nResults: ${passed} PASSED, ${failed} FAILED out of ${endpoints.length} endpoints`);
  process.exit(failed > 0 ? 1 : 0);
}

runAudit();
