#!/usr/bin/env node
/**
 * Error-handling contract audit.
 * Verifies unknown resources return JSON 404s (not HTML stack traces),
 * malformed bodies are rejected cleanly, and status endpoints report
 * live-vs-fallback truthfully.
 */
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:3000';

let pass = 0;
let fail = 0;

function record(ok, label, detail) {
  if (ok) {
    pass += 1;
    console.log(`[PASS] ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    fail += 1;
    console.log(`[FAIL] ${label}${detail ? ` (${detail})` : ''}`);
  }
}

async function check(statusFn, label, expectStatus, bodyCheck) {
  try {
    const { res, body, contentType } = await statusFn();
    let ok = res.status === expectStatus;
    const details = [`HTTP ${res.status}`];
    if (!ok) details.push(`expected ${expectStatus}`);
    if (contentType && contentType.includes('application/json')) details.push('json');
    else ok = false;
    if (ok && bodyCheck) {
      const res2 = bodyCheck(body);
      if (res2 !== true) {
        ok = false;
        details.push(`body: ${res2}`);
      }
    } else if (bodyCheck && ok) {
      ok = false;
      details.push('non-json body');
    }
    record(ok, label, details.join(', '));
  } catch (err) {
    record(false, label, `request error: ${err.message}`);
  }
}

async function get(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    res: { status: res.status, headers: res.headers },
    body,
    contentType: res.headers.get('content-type') || '',
  };
}

async function post(path, payload, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers,
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return {
    res: { status: res.status, headers: res.headers },
    body,
    contentType: res.headers.get('content-type') || '',
  };
}

async function main() {
  console.log('--- ERROR HANDLING & FALLBACK TRUTHFULNESS AUDIT ---');

  // Authenticate as admin for protected mutation routes
  let adminToken = null;
  try {
    const loginRes = await fetch(BASE + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      adminToken = loginData.accessToken;
      console.log(`[INFO] Admin authenticated: ${!!adminToken}`);
    }
  } catch { /* auth may not be available */ }

  // Unknown ticker -> JSON 404
  await check(() => get('/api/v1/assets/9999.ZZ'), 'unknown ticker /assets/9999.ZZ -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  await check(() => get('/api/v1/assets/9999.ZZ/prices'), 'unknown ticker /prices -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  await check(() => get('/api/v1/assets/9999.ZZ/predictions'), 'unknown ticker /predictions -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  await check(() => get('/api/v1/assets/9999.ZZ/sentiment'), 'unknown ticker /sentiment -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  // Unknown exchange -> JSON 404
  await check(() => get('/api/v1/exchanges/NYSE/overview'), 'unknown exchange overview -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  await check(() => get('/api/v1/exchanges/NYSE/rankings'), 'unknown exchange rankings -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  // Unknown backtesting ticker -> JSON 404
  await check(() => get('/api/v1/predictions/backtesting?ticker=9999.ZZ'), 'unknown backtesting ticker -> 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  // Catch-all unknown route -> JSON 404 (not HTML)
  await check(() => get('/api/v1/definitely-not-a-route'), 'unknown API route -> JSON 404', 404, b =>
    typeof b === 'object' && b.error ? true : 'missing error field');

  // Malformed JSON body on POST -> 4xx JSON, no crash
  await check(() => post('/api/v1/agents/run', '{not json', adminToken), 'malformed JSON body -> 4xx JSON', 400, b =>
    typeof b === 'object' && (b.error || b.message) ? true : 'missing error/message field');

  // Invalid exchange on report generation -> 4xx JSON
  await check(() => post('/api/v1/reports/generate', { exchange: 'NYSE' }, adminToken), 'invalid exchange on report generate -> 400', 400, b =>
    typeof b === 'object' && (b.error || b.message) ? true : 'missing error/message field');

  // Truthfulness: source status must classify live vs fallback
  await check(() => get('/api/v1/sources/status'), '/sources/status classifies LIVE vs FALLBACK', 200, b => {
    if (!Array.isArray(b.sources) || b.sources.length < 3) return 'missing sources array';
    const invalid = b.sources.filter(s => !['live', 'local-fallback'].includes(s.mode));
    if (invalid.length > 0) return `bad mode on ${invalid.map(s => s.id).join(',')}`;
    if (!b.modelPerformance) return 'missing modelPerformance';
    if (typeof b.modelPerformance.directionalAccuracyPercent !== 'number') return 'missing DA';
    if (!b.integrityChecks || !Array.isArray(b.integrityChecks)) return 'missing integrityChecks';
    const failed = b.integrityChecks.filter(c => !c.passed);
    if (failed.length > 0) return `failed integrity checks: ${failed.map(c => c.name).join(',')}`;
    return true;
  });

  // Pipeline status must expose real integrity checks
  await check(() => get('/api/v1/pipeline/status'), '/pipeline/status exposes integrityChecks', 200, b => {
    if (!b.integrityChecks || !Array.isArray(b.integrityChecks) || b.integrityChecks.length < 5) return 'missing integrityChecks';
    const failed = b.integrityChecks.filter(c => !c.passed);
    if (failed.length > 0) return `failed: ${failed.map(c => c.name).join(',')}`;
    return true;
  });

  // Reports must be computed (no fabricated static values)
  await check(() => get('/api/v1/reports'), '/reports returns computed briefings', 200, b => {
    const reports = b.reports || b;
    if (!Array.isArray(reports) || reports.length === 0) return 'missing reports';
    for (const r of reports) {
      const da = r.modelDirectionalAccuracy ?? r.directionalAccuracyPercent ?? r.directionalAccuracy;
      if (typeof da !== 'number') {
        return `report ${r.exchange} missing directional accuracy`;
      }
      if (typeof r.summaryProse !== 'string' || r.summaryProse.length < 40) {
        return `report ${r.exchange} missing computed prose`;
      }
    }
    return true;
  });

  console.log(`\nResults: ${pass} PASSED, ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
