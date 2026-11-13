# FEATURE TRACKER — HengSeng Sentiment Price Prediction Agent

**Status:** All features implemented and verified  
**Last updated:** 2026-11-12  
**Verification:** All features tested against live API on port 3000

---

## Implemented Features

| ID | Feature | Component | API Endpoint | Status | Verification |
|:---|:---|:---|:---|:---|:---|
| F-001 | Multi-exchange asset universe (HKEX + KRX) | `ExchangeView`, `AssetExplorerView` | `GET /api/v1/assets` | ✓ Implemented | 24/24 API PASS |
| F-002 | Deterministic OHLCV market data (10-day) | `marketData.ts` | `GET /api/v1/assets/:ticker/prices` | ✓ Implemented | 14 bars per asset |
| F-003 | Technical indicators (SMA, RSI, MACD, pivots) | `marketData.ts`, `AssetDetailModal` | Embedded in asset data | ✓ Implemented | Adaptive RSI period |
| F-004 | Multilingual social sentiment (zh-HK, ko, en) | `socialScraper.ts`, `SocialSentimentView` | `GET /api/v1/social/posts` | ✓ Implemented | 19 curated posts |
| F-005 | News intelligence with Exa + fallback | `newsEngine.ts`, `NewsIntelligenceView` | `GET /api/v1/news` | ✓ Implemented | 10 curated articles |
| F-006 | Walk-forward ML validation (5 folds × 10 assets) | `predictiveEngine.ts` | `GET /api/v1/predictions/performance` | ✓ Implemented | 50 OOS observations |
| F-007 | Multi-factor ensemble (Ridge + sentiment) | `predictiveEngine.ts` | `GET /api/v1/predictions/:ticker` | ✓ Implemented | DA 48%, MAPE 1.07% |
| F-008 | Naive persistence & SMA baselines | `predictiveEngine.ts` | `GET /api/v1/predictions/performance` | ✓ Implemented | DA 36% / 46% |
| F-009 | Next-period (n+1) price forecast | `predictiveEngine.ts` | `GET /api/v1/predictions/:ticker/predictions` | ✓ Implemented | 10 asset predictions |
| F-010 | Backtesting lab with actual vs predicted | `BacktestingView` | `GET /api/v1/predictions/backtesting` | ✓ Implemented | All 10 tickers verified |
| F-011 | Model performance leaderboard | `ModelPerformanceView` | `GET /api/v1/predictions/performance` | ✓ Implemented | 4 models compared |
| F-012 | Executive quantitative intelligence briefings | `ReportsView` | `GET /api/v1/reports` | ✓ Implemented | 3 reports (HKEX, KRX, ALL) |
| F-013 | Data source registry (live vs fallback) | `DataSourcesView` | `GET /api/v1/sources/status` | ✓ Implemented | Truthful classification |
| F-014 | Pipeline monitor (Agents 1-8) | `PipelineMonitorView` | `GET /api/v1/agents/status` | ✓ Implemented | 8 agents, 7/7 integrity |
| F-015 | System settings & credentials | `SettingsView` | `GET/PUT /api/v1/settings` | ✓ Implemented | Secrets masked |
| F-016 | Responsive navigation (sidebar + drawer) | `Navigation`, `Sidebar` | N/A (UI) | ✓ Implemented | 10/10 viewports PASS |
| F-017 | Asset deep-dive modal (4 tabs) | `AssetDetailModal` | `GET /api/v1/assets/:ticker/*` | ✓ Implemented | Modal open/close verified |
| F-018 | CSV export (asset rankings, reports) | `AssetExplorerView`, `ReportsView` | `GET /api/v1/reports/:id/download` | ✓ Implemented | Download verified |
| F-019 | Multi-language translation (EN/zh-HK/ko) | `LanguageContext`, `TranslatedText` | N/A (UI) | ✓ Implemented | 3/3 Python tests OK |
| F-020 | Dark/light theme toggle | `Navigation`, `App.tsx` | N/A (UI) | ✓ Implemented | Theme persists |
| F-021 | DropdownMenu component (overflow actions) | `DropdownMenu.tsx` | N/A (UI component) | ✓ Implemented | Used in ExchangeView, AssetExplorerView, PipelineMonitorView, ReportsView |
| F-022 | NestedTabs component (sub-navigation) | `DropdownMenu.tsx` | N/A (UI component) | ✓ Implemented | Used in AssetDetailModal prediction tab |
| F-023 | Asset action dropdowns | `ExchangeView`, `AssetExplorerView` | N/A (UI) | ✓ Implemented | View Terminal, Compare, Export |
| F-024 | Pipeline agent action dropdowns | `PipelineMonitorView` | N/A (UI) | ✓ Implemented | View Details, Restart, View Logs |
| F-025 | Report action dropdowns | `ReportsView` | N/A (UI) | ✓ Implemented | View Briefing, Download JSON, Print PDF |
| F-026 | Nested sub-tabs in asset prediction view | `AssetDetailModal` | N/A (UI) | ✓ Implemented | Forecast, Features, Confidence sub-tabs |

---

## Navigation Redesign (Completed)

| Aspect | Before | After |
|:---|:---|:---|
| Layout | Top bar + desktop sidebar + mobile drawer | Collapsible sidebar + top bar + overflow menu + mobile drawer |
| Menu items | 12 flat items | 5 grouped sections (Dashboard, Analysis, ML & Predictions, Tools, System) |
| Primary tabs | All 12 in sidebar | 4 primary (overview, exchange, assets, predictions) always visible |
| Secondary tabs | All 12 in sidebar | 8 secondary in overflow menu (three-dot) |
| Mobile drawer | Full nav list | Grouped sections + exchange filter + theme toggle |
| Sidebar collapse | Not supported | Collapsible to icon-only mode |
| Dropdown menus | None | Asset cards, pipeline agents, report cards have action dropdowns |
| Nested sub-tabs | None | AssetDetailModal prediction tab has sub-tabs (Forecast, Features, Confidence) |

---

## New Components

| Component | Purpose | Location |
|:---|:---|:---|
| `DropdownMenu` | Reusable overflow action dropdown with click-outside close | `src/components/DropdownMenu.tsx` |
| `NestedTabs` | Compact horizontal sub-tab navigation with scroll overflow | `src/components/DropdownMenu.tsx` |

## Dropdown Menu Integration

| View | Dropdown Locations | Actions |
|:---|:---|:---|
| `ExchangeView` | Each asset card | View Terminal, Compare Exchange, Export Data |
| `AssetExplorerView` | Table rows (desktop) + cards (mobile) | View Terminal, Compare Assets, Export Asset |
| `PipelineMonitorView` | Each agent card | View Details, Restart Agent, View Logs |
| `ReportsView` | Each report card | View Briefing, Download JSON, Print PDF |

## Nested Sub-tab Integration

| View | Location | Sub-tabs |
|:---|:---|:---|
| `AssetDetailModal` | Prediction tab | Forecast Target, Feature Breakdown, Confidence Intervals |

---

## Responsive Design (Completed)

| Breakpoint | Layout | Navigation | Status |
|:---|:---|:---|:---|
| 320px | Single column | Mobile drawer (hamburger) | ✓ PASS |
| 360px | Single column | Mobile drawer | ✓ PASS |
| 375px | Single column | Mobile drawer | ✓ PASS |
| 390px | Single column | Mobile drawer | ✓ PASS |
| 430px | Single column | Mobile drawer | ✓ PASS |
| 768px | Two column | Mobile drawer | ✓ PASS |
| 1024px | Two/three column | Desktop sidebar | ✓ PASS |
| 1280px | Three column | Desktop sidebar | ✓ PASS |
| 1440px | Three column | Desktop sidebar | ✓ PASS |
| 1920px | Three column | Desktop sidebar | ✓ PASS |

No horizontal overflow detected on any viewport. All mobile drawer interactions functional.

---

## ML Metrics (Verified Against Live API)

**Deployed Model:** Multi-Factor Quant Sentiment Ensemble (v1.0.0-walkforward-ensemble)

| Metric | Value | Source |
|:---|:---|:---|
| Directional Accuracy | 48% | `GET /api/v1/predictions/performance` |
| MAPE | 1.07% | `GET /api/v1/predictions/performance` |
| MAE (HKEX) | 2.27 HKD | `GET /api/v1/predictions/performance` |
| MAE (KRX) | 1,017.15 KRW | `GET /api/v1/predictions/performance` |
| OOS R² | -2.1 | `GET /api/v1/predictions/performance` |
| OOS Observations | 50 | `GET /api/v1/predictions/performance` |
| Validation | Walk-forward, 5 folds × 10 assets | `GET /api/v1/predictions/performance` |

**All metrics match between API, executive reports, and documentation.**

---

## Navigation Redesign (Completed)

| Aspect | Before | After |
|:---|:---|:---|
| Layout | Top bar + desktop sidebar + mobile drawer | Collapsible sidebar + top bar + overflow menu + mobile drawer |
| Menu items | 12 flat items | 5 grouped sections (Dashboard, Analysis, ML & Predictions, Tools, System) |
| Primary tabs | All 12 in sidebar | 4 primary (overview, exchange, assets, predictions) always visible |
| Secondary tabs | All 12 in sidebar | 8 secondary in overflow menu (three-dot) |
| Mobile drawer | Full nav list | Grouped sections + exchange filter + theme toggle |
| Sidebar collapse | Not supported | Collapsible to icon-only mode |
| Dropdown menus | None | Asset cards, pipeline agents, report cards have action dropdowns |
| Nested sub-tabs | None | AssetDetailModal prediction tab has sub-tabs (Forecast, Features, Confidence) |

| Component | Purpose | Location |
|:---|:---|:---|
| `DropdownMenu` | Reusable overflow action dropdown with click-outside close | `src/components/DropdownMenu.tsx` |
| `NestedTabs` | Compact horizontal sub-tab navigation with scroll overflow | `src/components/DropdownMenu.tsx` |

## Dropdown Menu Integration

| View | Dropdown Locations | Actions |
|:---|:---|:---|
| `ExchangeView` | Each asset card | View Terminal, Compare Exchange, Export Data |
| `AssetExplorerView` | Table rows (desktop) + cards (mobile) | View Terminal, Compare Assets, Export Asset |
| `PipelineMonitorView` | Each agent card | View Details, Restart Agent, View Logs |
| `ReportsView` | Each report card | View Briefing, Download JSON, Print PDF |

## Nested Sub-tab Integration

| View | Location | Sub-tabs |
|:---|:---|:---|
| `AssetDetailModal` | Prediction tab | Forecast Target, Feature Breakdown, Confidence Intervals |

## Documentation Status

| File | Status | Last Verified |
|:---|:---|:---|
| `FINAL_SUBMISSION_REPORT.md` | Updated with live metrics | 2026-11-12 |
| `INDEPENDENT_QA_VERIFICATION.md` | MAE inconsistency resolved | 2026-11-12 |
| `QA_REPORT.md` | Marked as superseded | 2026-11-12 |
| `BUG_TRACKER.md` | Created | 2026-11-12 |
| `FEATURE_TRACKER.md` | Created | 2026-11-12 |

---

## New Features — Application-Wide Completion (2026-11-13)

| ID | Feature | Backend | Database | Frontend | Auth/RBAC | Tests | Status | Verification |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| F-027 | SQLite database persistence | `server/db/sqlite.ts` | `hengseng.db` (all tables) | API reads/writes DB | audit logging | API contract 24/24 | Implemented | Seed from JSON on first run; all reads/writes via SQL |
| F-028 | Authentication (register/login/me) | `auth/*` routes | `users` table | `LoginView`, `AuthContext` | JWT session | Jest + Vitest | Implemented | 12 backend + 5 frontend tests pass |
| F-029 | Role-based access control (admin/manager/viewer) | `requireRole(...)` middleware | n/a | UI gating | route + component level | Jest (403 viewer) | Implemented | Mutations protected; admin/manager/viewer seeded |
| F-030 | Em dash → hyphen normalization | n/a | n/a | all components | n/a | lint PASS | Implemented | 10 source files normalized |
| F-031 | Overflow menu shows ALL navigation items | n/a | n/a | `Navigation.tsx` | n/a | lint PASS | Implemented | Desktop three-dot menu renders every grouped item |
| F-032 | Overview sentiment high-contrast readout | n/a | n/a | `OverviewView.tsx` | n/a | lint PASS | Implemented | Sentiment Range readout, light + dark safe |
| F-033 | Frontend unit tests (Vitest) | n/a | n/a | `api.test.ts`, `LoginView.test.tsx` | n/a | 5/5 pass | Implemented | Session helpers + login form render |
| F-034 | Backend unit tests (Jest + Supertest) | all API routes | SQLite via createApp | n/a | auth + RBAC tested | 12/12 pass | Implemented | Auth, contracts, role access |
| F-035 | End-to-end tests (Playwright) | API via browser `request` | n/a | `app.spec.ts` | auth (401) tested | 10/10 API pass | Implemented | Rendered-browser UI blocked by host (see QA report) |

