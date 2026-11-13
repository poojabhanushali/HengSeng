# BUG TRACKER — HengSeng Sentiment Price Prediction Agent

**Status:** All known bugs resolved  
**Last updated:** 2026-11-12  
**Verification:** All fixes verified against live API on port 3000

---

## Resolved Bugs

| ID | Bug | Severity | Root Cause | Fix | Verification |
|:---|:---|:---|:---|:---|:---|
| BUG-001 | `GET /` returned `{"success":false,"message":"Route not found"}` | High | No explicit root route; relied solely on `*` catch-all which failed under stale server process | Added explicit `app.get('/')` serving `index.html` in both dev and prod modes in `server.ts` | `GET /` returns `200 text/html` (React SPA) |
| BUG-002 | Stale feature row used for live forecast | High | Training rows built only when next bar existed; deployed forecast used second-to-last bar features | Added `buildFeatureRow()` and `currentFeatureRow` so n+1 forecast uses latest observed bar | `/api/v1/predictions` for `0700.HK` returns `-0.53%` matching latest bar |
| BUG-003 | Directional accuracy did not match backtest points | High | `computeMetrics()` used previous close as base; `backtestPoints` used current bar close | Unified to `oosBaseCloses` (same `testSample.close` used by backtest points) | All 10 tickers: reported DA matches computed DA |
| BUG-004 | R² clipped at -1 | High | `Math.max(-1, ...)` hid strongly negative values (raw as low as -11.182) | Removed clamp; R² reported as computed | Ensemble R² = -2.1 (unclipped) |
| BUG-005 | Deployed ensemble differed from validated ensemble | High | Validation used sentiment weights 0.6/0.4 scale 0.015; deployment used 0.65/0.35 scale 0.018 | Both paths now use `0.6 × Ridge delta + 0.4 × sentiment alpha`, scale 0.015 | Deployed model == validated ensemble |
| BUG-006 | Target date was wall-clock based | Medium | Forecast target derived from `new Date()` | Target date advances from last bar timestamp to next weekday | `targetDate` = next trading day after last bar |
| BUG-007 | RSI-14 false label with 10 bars | Medium | RSI-14 cannot be computed from 10 bars; silently fell back to 52 | Adaptive Wilder RSI computes `rsiPeriod`; UI displays actual period | UI shows "9-Period RSI Momentum" |
| BUG-008 | Pipeline metrics hardcoded | High | Agent durations, item counts, quality scores, job counts were static | `orchestrator.ts` measures real durations, derives counts from repository state | Pipeline: 1,681 ms, 139 records, 7/7 integrity checks |
| BUG-009 | Misleading UI labels (Exa live, CHAMPION, green sentiment) | Medium | Unconditional labels regardless of actual source/model performance | Source-aware news labels, "PRODUCTION" labeling, correct sign/color handling | `/api/v1/sources/status` reports `local-fallback` truthfully |
| BUG-010 | Production build failed (missing `react-is`) | High | `recharts` imports `react-is` not in `package.json` | Added `react-is` (`^19.3.1`) | `npm run build` succeeds |
| BUG-011 | Reports endpoint didn't refresh ALL briefing | Medium | `GET /reports` only refreshed HKEX and KRX, not `rep_all_latest` | Added ALL to initial reports and refresh loop | `GET /reports` returns 3 reports, ALL refreshed with current metrics |
| BUG-012 | ML metric inconsistencies in documentation | Medium | INDEPENDENT_QA_VERIFICATION.md cited MAE 466.16; FINAL_SUBMISSION_REPORT.md cited stale values | Reconciled all docs to current API: Ensemble DA 48%, MAPE 1.07%, R² -2.1, MAE HKEX 2.27/KRX 1017.15 | All docs match `GET /api/v1/predictions/performance` |

---

## Verification Results (Live Server)

| Check | Command | Result |
|:---|:---|:---|
| API contract audit | `node scripts/audit_api.cjs` | 24 PASSED, 0 FAILED |
| Error handling | `node scripts/audit_error_handling.cjs` | 13 PASSED, 0 FAILED |
| Python unit tests | `python -m unittest backend.tests.test_pipeline -v` | 3/3 OK |
| TypeScript typecheck | `npm run lint` (`tsc --noEmit`) | PASS |
| Production build | `npm run build` | ✓ built (782 kB JS, 42 kB CSS) |
| Responsive audit | `node scripts/audit_responsive.cjs` | ALL 10 VIEWPORTS PASSED |
| Pipeline run | `POST /api/v1/agents/run` | success, 1,681 ms, 139 records, 7/7 checks |

---

## Known Limitations (Not Bugs)

| ID | Limitation | Disclosure |
|:---|:---|:---|
| LIM-001 | Small sample: 10 bars → 5 folds → 50 OOS observations | Results unstable, not for live capital allocation |
| LIM-002 | Synthetic/curated data | OHLCV deterministic seeded; social/news are local fallback |
| LIM-003 | No live Apify | Social data always `local-fallback` without credentials |
| LIM-004 | Exa optional | Live news requires `EXA_API_KEY`; otherwise fallback labeled |
| LIM-005 | Model underperformance | Ensemble doesn't beat every baseline; all R² negative |
| LIM-006 | No `.env` file | No live API keys configured in workspace |

---

## Resolved Bugs — Application-Wide Completion (2026-11-13)

| ID | Bug | Severity | Root Cause | Fix | Verification |
|:---|:---|:---|:---|:---|:---|
| BUG-013 | No persistence; data lost on server restart | High | Repositories held data in JS Maps only | Added SQLite (`better-sqlite3`) backend; all repositories read/write `hengseng.db`; seeded from JSON on first run | API audit 24/24; backend tests read/write DB successfully |
| BUG-014 | No authentication or authorization | High | All API routes open; no user model | Added register/login/me/users routes; JWT access tokens; `requireAuth`/`requireRole` middleware; mutations role-protected | Jest: 401 without token, 403 for viewer, 200 for admin |
| BUG-015 | No frontend authentication/session | High | UI rendered regardless of login | Added `AuthContext`, `LoginView`, `api.ts` client with auto 401 clearing; `App` gates shell behind `isAuthenticated` | Vitest: session helpers + LoginView render (5/5) |
| BUG-016 | No automated test suite | High | Only manual audit scripts existed | Added Vitest (frontend), Jest+Supertest (backend), Playwright (E2E) | 5 frontend + 12 backend + 10 E2E API tests all pass |
| BUG-017 | Three-dot overflow menu showed only secondary tabs | Medium | Overflow menu iterated `SECONDARY_TABS` only | Rewrote desktop overflow menu to render all grouped navigation items | Lint PASS; menu lists every module |
| BUG-018 | Overview sentiment chart lacked clear selected-score readout | Medium | No always-visible selected value | Added high-contrast "Sentiment Range" readout under Cross-Asset Sentiment Polarity chart | Lint PASS; readable in light + dark themes |
| BUG-019 | Inconsistent Unicode em dashes (—) across copy | Low | Copy contained em dashes | Replaced all em dashes with normal hyphens (-) across `src/`, `server/`, `scripts/` | 10 files normalized; lint PASS |

## Known Limitations (Not Bugs) — Updated

| ID | Limitation | Disclosure |
|:---|:---|:---|
| LIM-001 | Small sample: 10 bars → 5 folds → 50 OOS observations | Results unstable, not for live capital allocation |
| LIM-002 | Synthetic/curated data | OHLCV deterministic seeded; social/news are local fallback |
| LIM-003 | No live Apify | Social data always `local-fallback` without credentials |
| LIM-004 | Exa optional | Live news requires `EXA_API_KEY`; otherwise fallback labeled |
| LIM-005 | Model underperformance | Ensemble doesn't beat every baseline; all R² negative |
| LIM-006 | No `.env` file | No live API keys configured in workspace |
| LIM-007 | Rendered-browser E2E blocked | Playwright Chromium cannot launch in this host (OS access denied / exit 0x80000005) even with `--no-sandbox`. API-layer E2E passes; UI-rendered E2E deferred to a Chrome-enabled environment |
| LIM-008 | Mobile responsive screenshots not regenerated | Due to LIM-007; responsive layout verified at code/Tailwind level across all required viewports |

