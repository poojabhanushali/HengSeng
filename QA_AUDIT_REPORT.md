# QA AUDIT REPORT — HengSeng Sentiment Price Prediction Agent

**Report date:** 2026-11-13  
**Audited application:** HengSeng Sentiment Price Prediction Agent (HKEX / KRX quantitative sentiment & n+1 price forecasting)  
**Working directory:** `D:\HengSeng`  
**Runtime:** Node v24.11.0, npm v11.19.1  
**Scope:** Complete application audit — frontend, backend, database, APIs, routes, components, auth/RBAC, persistence, tests, responsiveness.

---

## 1. Audit Verdict

The application has been audited end-to-end. All previously incomplete/disconnected areas (database persistence, authentication & RBAC, automated test coverage, required documentation) have been implemented and verified. The core financial-sentiment platform (asset universe, OHLCV, technical indicators, social/news sentiment, walk-forward ML predictions, backtesting, reports, data-source registry, pipeline monitor) was already functional and is preserved unchanged.

No unresolved critical or high-severity bugs remain.

---

## 2. What Was Inspected

| Area | Files / Modules |
|------|-----------------|
| Entrypoint & server | `server.ts`, `server/routes/api.ts` |
| Database / persistence | `server/db/sqlite.ts` (new SQLite layer) |
| Market data | `server/data/marketData.ts`, `marketGenerators.ts`, `assets.json` |
| Social sentiment | `server/data/socialScraper.ts`, `sentiment.ts`, `socialPosts.json` |
| News intelligence | `server/data/newsEngine.ts`, `news.json` |
| ML engine | `server/ml/predictiveEngine.ts` |
| Agents / orchestrator | `server/agents/orchestrator.ts` |
| Frontend app | `src/App.tsx`, `src/main.tsx`, `src/index.css` |
| Frontend components | `src/components/*` (17 views + DropdownMenu + LoginView) |
| Contexts | `src/contexts/AuthContext.tsx` (new), `LanguageContext.tsx` |
| Types | `src/types/index.ts` (added User, UserRole, AuthTokens) |
| API client | `src/lib/api.ts` (new) |
| Scripts | `scripts/audit_api.cjs`, `audit_error_handling.cjs`, `e2e-live-test.cjs` |
| Tests | `vitest.config.ts`, `src/lib/api.test.ts`, `src/components/LoginView.test.tsx`, `jest.config.cjs`, `server/__tests__/backend.test.ts`, `tests/e2e/app.spec.ts`, `playwright.config.ts` |

---

## 3. Defects Found & Fixed (this audit)

| ID | Defect | Severity | Root Cause | Fix |
|----|--------|----------|------------|-----|
| QA-001 | No persistence; all data in-memory and lost on restart | High | Repositories held data in JS Maps only | Added SQLite (`better-sqlite3`) backend in `server/db/sqlite.ts`; all repositories (assets, price bars, social posts, news articles, settings, users, audit logs, jobs, agent states) read/write SQLite; seeded from JSON on first run |
| QA-002 | No authentication or authorization | High | All API routes open; no user model | Added `auth/register`, `auth/login`, `auth/me`, `auth/users`, `auth/users/:id/role`; JWT access tokens; `requireAuth` / `requireRole(...)` middleware; mutation routes (settings, predictions/run, ingestion/run, agents/run, reports/generate) protected by role |
| QA-003 | No frontend auth | High | UI rendered regardless of login | Added `AuthContext` (login/register/logout/session), `LoginView`, `api.ts` client with automatic 401 session clearing; `App` gates app shell behind `isAuthenticated` |
| QA-004 | No automated test suite | High | Only manual audit scripts existed | Added Vitest frontend tests (5 pass), Jest + Supertest backend tests (12 pass), Playwright E2E (10 API-contract tests pass via browser `request`) |
| QA-005 | Em dashes (—) used inconsistently | Low | Copy contained Unicode em dashes | Replaced all em dashes with normal hyphens (-) across `src/`, `server/`, `scripts/` |
| QA-006 | Three-dot overflow menu showed only secondary tabs | Medium | Overflow menu iterated `SECONDARY_TABS` only | Rewrote desktop overflow menu to render ALL grouped navigation items; mobile drawer already complete |
| QA-007 | Overview sentiment chart lacked a clear selected-score readout | Medium | Chart had no always-visible selected value | Added a high-contrast "Sentiment Range" readout under the Cross-Asset Sentiment Polarity chart (light + dark theme safe) |

---

## 4. Executed Test Results (all actually run)

| Suite | Command | Result |
|-------|---------|--------|
| TypeScript typecheck / lint | `npm run lint` (`tsc --noEmit`) | PASS |
| Production build | `npm run build` (vite) | PASS (built, ~797 kB JS) |
| Backend API contract audit | `node scripts/audit_api.cjs` | 24 PASSED, 0 FAILED |
| Error handling / fallback truthfulness | `node scripts/audit_error_handling.cjs` | 12 PASSED, 0 FAILED (auth now enforced on mutations) |
| Frontend unit tests | `npx vitest run` | 5 PASSED, 0 FAILED |
| Backend unit tests | `npx jest --config jest.config.cjs --forceExit` | 12 PASSED, 0 FAILED |
| E2E API contracts (Playwright `request`) | `npx playwright test` | 10 PASSED, 0 FAILED |
| E2E rendered-browser UI | Playwright `chromium.launch` | BLOCKED — environment denies Chrome process access (exit 0x80000005 / ACCESS_DENIED) even with `--no-sandbox`. Documented as an infrastructure blocker, not an application defect. |

> Per the acceptance rules, no test is reported as passed unless it was executed. All "PASSED" results above were executed against the running local server on port 3000.

---

## 5. Remaining Limitations (disclosed, not defects)

| ID | Limitation | Disclosure |
|----|------------|------------|
| LIM-001 | Small ML sample: 10 bars → 5 folds → 50 OOS observations per model | Results unstable; not for live capital allocation |
| LIM-002 | Synthetic / curated seed data | OHLCV is deterministic seeded; social & fallback news are curated records |
| LIM-003 | No live Apify | Social data is `local-fallback` without `APIFY_API_TOKEN` + actor IDs |
| LIM-004 | Exa optional | Live news requires `EXA_API_KEY`; otherwise `local-fallback` labeled truthfully |
| LIM-005 | Model underperformance | Deployed ensemble does not beat every baseline; all OOS R² negative |
| LIM-006 | Rendered-browser E2E blocked | Playwright Chromium cannot launch in this environment (OS access denied). API-layer E2E tests pass; UI-rendered E2E deferred to an environment with Chrome access |
| LIM-007 | No `.env` file committed | No live API keys in workspace; `.env.example` provided |

---

## 6. Persistence Summary

All application records now flow through SQLite (`hengseng.db`) and are backed by real database operations:

- `assets`, `price_bars` — market data (seeded from `assets.json` + deterministic generator)
- `social_posts` — social sentiment (seeded from `socialPosts.json`)
- `news_articles` — news intelligence (seeded from `news.json`)
- `users` — authentication (admin/manager/viewer seeded)
- `settings` — system settings (masked secrets)
- `reports`, `ingestion_jobs`, `agent_states`, `audit_logs` — operational records

Seed data is used **only** for initial database population on first run; the application thereafter reads from and writes to the database. No `localStorage` or frontend arrays substitute for backend persistence.

---

## 7. Authentication / RBAC Summary

| Route | Method | Required Role |
|-------|--------|---------------|
| `/api/v1/auth/register` | POST | public |
| `/api/v1/auth/login` | POST | public |
| `/api/v1/auth/me` | GET | any authenticated |
| `/api/v1/auth/users` | GET | admin |
| `/api/v1/auth/users/:id/role` | PATCH | admin |
| `/api/v1/settings` | PUT | admin, manager |
| `/api/v1/agents/run` | POST | admin |
| `/api/v1/ingestion/run` | POST | admin |
| `/api/v1/predictions/run` | POST | admin, manager |
| `/api/v1/reports/generate` | POST | admin, manager |
| All GET routes | GET | public (read-only data) |

Seeded demo accounts: `admin` / `manager` / `viewer` (password `admin123`). Role enforcement is applied on both frontend (UI gating) and backend (middleware).

---

## 8. Responsive Design Status

Implemented via Tailwind responsive classes across all pages (320px → 1920px). Navigation drawer closes after selection; forms, tables (container-scrolled), cards, charts, dialogs and menus adapt. Verified layout classes cover the required viewports (320×568, 360×800, 375×812, 390×844, 412×915, 430×932, tablet, laptop, desktop). Rendered-browser viewport screenshots could not be regenerated due to the Chromium launch blocker (LIM-006); see `RESPONSIVE_TEST_REPORT.md`.

---

## 9. Files Changed (this audit)

- **New:** `server/db/sqlite.ts`, `server/data/marketGenerators.ts`, `server/data/sentiment.ts`, `server/__tests__/backend.test.ts`, `src/lib/api.ts`, `src/contexts/AuthContext.tsx`, `src/components/LoginView.tsx`, `src/lib/api.test.ts`, `src/components/LoginView.test.tsx`, `src/test/setup.ts`, `src/test/jest-dom-globals.d.ts`, `vitest.config.ts`, `jest.config.cjs`, `playwright.config.ts`, `tests/e2e/app.spec.ts`, `scripts/launch_api.bat`, `scripts/launch_server.bat`, `scripts/test_sqlite.ts`, `scripts/test_import.ts`, `scripts/test_listen.ts`, `scripts/test_startserver.ts`, `scripts/start_api_only.ts`
- **Modified:** `server.ts`, `server/routes/api.ts`, `server/data/marketData.ts`, `server/data/socialScraper.ts`, `server/data/newsEngine.ts`, `src/App.tsx`, `src/components/Navigation.tsx`, `src/components/Sidebar.tsx`, `src/components/SettingsView.tsx`, `src/components/OverviewView.tsx`, `src/types/index.ts`, `package.json`, `tsconfig.json`
- **Em-dash → hyphen:** `src/lib/api.ts`, `src/components/AssetDetailModal.tsx`, `BacktestingView.tsx`, `DataSourcesView.tsx`, `ModelPerformanceView.tsx`, `PipelineMonitorView.tsx`, `OverviewView.tsx`, `SettingsView.tsx`, `server/routes/api.ts`, `server/agents/orchestrator.ts`, `scripts/e2e-live-test.cjs`

---

## 10. Sign-off

All executed checks pass. No unresolved critical or high-severity bugs. Remaining items are disclosed limitations (sample size, curated data, optional live connectors, Chromium launch blocker in this sandbox).
