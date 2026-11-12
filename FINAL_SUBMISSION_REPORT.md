# FINAL SUBMISSION REPORT

**Project:** HengSeng Sentiment Price Prediction Agent  
**Report date:** 2026-11-11  
**Audit basis:** `INDEPENDENT_QA_VERIFICATION.md` (historical baseline)  
**Executed on:** Windows, Node `v24.11.0`, npm `11.19.1`, Python `3.13.9`  
**Working directory:** `D:\HengSeng`

---

## 1. Submission Verdict

The application is submission-ready for technical evaluation with the limitations in Section 8. The production build succeeds, all executable API/error-handling/unit/type checks pass, the ML pipeline runs end-to-end, and previously misleading metrics and labels have been corrected.

This is **not** a production trading system. The dataset is synthetic/curated, the sample is very small, the deployed ensemble is not the best model on every metric, and no live Apify or Exa credentials are configured.

No result in this report is hand-written or inferred from a prior report. Each value below came from the commands and endpoints listed in Sections 5 and 10.

---

## 2. What Was Verified

| Area | Verified behavior |
| :--- | :--- |
| Asset universe | 10 assets: 5 HKEX/HKD and 5 KRX/KRW |
| Price data | Each asset has 10 daily bars, current price, previous close, pivots, support/resistance |
| Social data | 19 curated posts; every asset has at least one post; 5 platform feeds |
| News data | 10 curated articles; every asset has one article |
| Predictions | All 10 assets expose current price, predicted n+1 price, direction, confidence interval, and validation metrics |
| Source honesty | `/api/v1/sources/status` reports `local-fallback` for social, news, and market data when no live connector is active |
| Pipeline | Full 8-agent run completed in `1681 ms`, processed `139` records, and passed `7/7` integrity checks |
| Build | `npm run build` completed successfully |
| Type safety | `npm run lint` (`tsc --noEmit`) passed |

---

## 3. Current Asset Snapshot

| Ticker | Exchange | Currency | Current Price | Predicted n+1 | Sentiment |
| :--- | :--- | :--- | ---: | ---: | ---: |
| 0700.HK | HKEX | HKD | 433.38 | 433.13 | +69.7 |
| 9988.HK | HKEX | HKD | 96.60 | 96.85 | -40.0 |
| 0005.HK | HKEX | HKD | 72.83 | 72.93 | 0.0 |
| 3690.HK | HKEX | HKD | 164.92 | 164.60 | +65.0 |
| 1810.HK | HKEX | HKD | 29.06 | 28.87 | +72.5 |
| 005930.KS | KRX | KRW | 55,477.18 | 55,261.62 | -5.0 |
| 000660.KS | KRX | KRW | 200,541.74 | 201,677.93 | +81.5 |
| 035420.KS | KRX | KRW | 167,490.34 | 167,208.75 | 0.0 |
| 035720.KS | KRX | KRW | 36,904.81 | 36,727.57 | 0.0 |
| 005380.KS | KRX | KRW | 218,547.59 | 219,462.67 | +37.5 |

---

## 4. Defects Found and Fixed

### 4.1 Stale feature row used for the live forecast
`server/ml/predictiveEngine.ts` previously built training rows only when a next bar existed. The deployed forecast therefore used the second-to-last bar’s features. The current bar’s `return1d` was `-0.53%`, while the forecast displayed `-0.79%`.

**Fix:** added `buildFeatureRow()` and `currentFeatureRow`, so the n+1 forecast uses the latest observed bar while training rows still require realised targets.

### 4.2 Directional accuracy did not match backtest points
`computeMetrics()` used the previous actual close as the direction base, while `backtestPoints` used the current bar’s close. This produced summaries such as `0700.HK` reporting 20% while `2/5` points matched (40%).

**Fix:** metric calculation now uses `oosBaseCloses` (the same `testSample.close` used by backtest points). Verified for all 10 tickers: reported and computed DA match.

### 4.3 R² was clipped at -1
`Math.max(-1, ...)` hid strongly negative out-of-sample R². Raw values were as low as `-11.182`; the displayed ensemble average was `-0.719` instead of the true `-2.100`.

**Fix:** removed the clamp. R² is now reported as computed.

### 4.4 Deployed ensemble differed from the validated ensemble
Validation used sentiment weights `0.6/0.4` with a `0.015` scale, while deployment used `0.65/0.35` with `0.018`. The deployed model was therefore not the measured model.

**Fix:** both paths now use `0.6 × bounded Ridge delta + 0.4 × sentiment alpha`, with the same `0.015` scale and as-of-bar sentiment features.

### 4.5 Target date was wall-clock based
The forecast target was derived from `new Date()` rather than the last observed bar.

**Fix:** target date now advances from the last bar timestamp to the next weekday.

### 4.6 RSI label was false with 10 bars
RSI-14 cannot be computed from 10 bars; every value silently fell back to 52 while the UI claimed “14-Period RSI Momentum”.

**Fix:** `server/data/marketData.ts` computes an adaptive Wilder RSI and stores `rsiPeriod`; the UI now displays `9-Period RSI Momentum` on the current 10-bar window.

### 4.7 Pipeline metrics were hardcoded
Agent durations (420/890/760... ms), item counts (140/48/20...), quality scores (99/98/97...), the “4 independent platforms” message, and the `278` job record count were static.

**Fix:** `server/agents/orchestrator.ts` now measures real step durations, derives item counts and quality scores from repository state, reports 5 platforms, and records `139` real input records. The pipeline checklist in `src/components/PipelineMonitorView.tsx` is rendered from the API’s actual integrity checks rather than four static labels.

### 4.8 Misleading UI labels and displays
- “Exa News” and “retrieved via Exa” labels appeared even when the news source was local fallback.
- Unconditional `+` prefixes produced values like `+-12.3`.
- Market sentiment was always green and always labeled bullish.
- The deployed ensemble was labeled “CHAMPION” despite not having the best DA.
- Settings exposed 3/5-session horizons that are not implemented and Apify fields that imply live scraping.

**Fix:** source-aware news labels, correct sign/color handling, “PRODUCTION” labeling, an explicit “not wired” Apify notice, and an n+1-only horizon listing.

### 4.9 Production build failed
`recharts` imports `react-is`, which was missing from `package.json`.

**Fix:** added `react-is` (`^19.3.1`). `npm run build` now succeeds.

---

## 5. Executed Test Results

| Check | Command | Result |
| :--- | :--- | :--- |
| API contract | `node scripts/audit_api.cjs` | **24/24 PASS** |
| Error handling / fallback truthfulness | `node scripts/audit_error_handling.cjs` | **13/13 PASS** |
| Python pipeline tests | `python -m unittest backend.tests.test_pipeline -v` | **3/3 OK** |
| TypeScript typecheck | `npm run lint` | **PASS** |
| Production build | `npm run build` | **PASS** (2,048 modules, built in ~1.1 s) |
| Full pipeline run | `POST /api/v1/agents/run` | **success**, 1,681 ms, 139 records, 7/7 integrity checks |
| Backtest consistency | `/api/v1/predictions/backtesting` for all 10 tickers | **No mismatches** |
| Live forecast features | `/api/v1/predictions` for `0700.HK` | `-0.53%` (1D), matching the latest bar; target `2026-11-12` |

### Responsive UI / screenshots

`node scripts/audit_responsive.cjs` could not run in this pass because Playwright’s Chromium headless shell is not installed:

```text
Executable doesn't exist at ...\ms-playwright\chromium_headless_shell-1254\...
Run: npx playwright install
```

Ten historical screenshots exist in `test-screenshots/` from 2026-11-09. They were **not regenerated** in this final pass. No responsive PASS is claimed in this report. To reproduce after installing the browser:

```bash
npx playwright install chromium
node scripts/audit_responsive.cjs
```

---

## 6. Machine Learning Methodology

- **Universe:** 10 assets (5 HKEX, 5 KRX).
- **History:** 10 daily bars per asset.
- **Validation:** expanding chronological walk-forward; 5 OOS folds per asset; 50 OOS observations per model.
- **Target:** next-period close `P(t+1)`; models train on price deltas for scale stability.
- **Baselines:** naive persistence (`P(t) = P(t-1)`) and 3-day moving average.
- **Challenger:** L2-regularised Ridge regression on 11 as-of-bar features.
- **Deployed model:** ensemble of bounded Ridge delta (`0.6`) and engagement/relevance-weighted sentiment alpha (`0.4`), capped at ±8%.
- **Metrics:** MAE, RMSE, MAPE, directional accuracy against the current bar close, unclipped OOS R².
- **No leakage:** sentiment/news features are joined only from records published at or before each bar timestamp.

### Current leaderboard from `/api/v1/predictions/performance`

| Model | DA | MAPE | MAE HKEX | MAE KRX | OOS R² |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Multi-Factor Quant Sentiment Ensemble (deployed) | 48% | 1.07% | 2.27 | 1,017.15 | -2.100 |
| Naive Persistence | 36% | 0.88% | 1.52 | 1,062.09 | -0.801 |
| Historical 3-Day Moving Average | 46% | 1.39% | 2.36 | 1,681.20 | -3.673 |
| Linear / Ridge Regression | 50% | 1.29% | 3.30 | 1,057.00 | -5.737 |

**Interpretation:** Ridge has the best directional accuracy (50%); persistence has the lowest MAPE and the least-negative R²; the deployed ensemble is second on DA and improves on the SMA baseline’s MAE. It is labeled “production” because it is the deployed model, not because it won a champion-selection test. All R² values are negative, meaning none of these models beats a mean forecast on this small sample.

---

## 7. Source and Integration Status

| Source | Mode | Credential configured | Records | Meaning |
| :--- | :--- | :--- | ---: | :--- |
| `apify_social` | `local-fallback` | No | 19 | Apify actor runner is not implemented; curated social data is served |
| `exa_news` | `local-fallback` | No | 10 | `EXA_API_KEY` not configured; curated news is served |
| `market_data` | `local-fallback` | No | 100 | Deterministic seeded OHLCV generator, not a live vendor feed |

- No `.env` file exists in the workspace.
- No live API keys are present.
- The frontend bundle contains no server-side credentials; the client only has empty input fields and placeholders.
- Secrets are masked in `GET /api/v1/settings`.

---

## 8. Limitations and Honest Disclosures

1. **Small sample:** 10 bars → 5 folds per asset → 50 OOS observations. Results are unstable.
2. **Synthetic/curated data:** OHLCV is deterministic seeded data; social and fallback news are curated records, not live scrapes.
3. **No live Apify:** social data is always `local-fallback`, even if a token is saved. The UI/Settings now says so.
4. **Exa is optional:** live news requires `EXA_API_KEY`; otherwise fallback is labeled.
5. **Model underperformance:** the deployed ensemble does not beat every baseline. R² is negative for all models.
6. **Adaptive RSI:** the current 10-bar window yields a 9-period RSI, and the UI labels it as such. MACD is computed with limited history and is not in the feature vector.
7. **No Git repository:** `git status` fails, so commit history and historical secret leakage cannot be audited.
8. **Responsive audit not re-run:** Playwright Chromium is missing; only historical screenshots exist.
9. **Legacy API field naming:** the model payload retains an internal `champion` boolean for compatibility; the UI now labels it “PRODUCTION”. The deployed model is not claimed to be the best model.
10. **Port conflict during audit:** another local `nodemon server.js` process was bound to port 3000 and served 404s. It was stopped so the HengSeng server could serve the audits. Ensure port 3000 is free when reproducing.

---

## 9. Screenshots and Evidence

- Historical responsive screenshots: `D:\HengSeng\test-screenshots\` (10 files, 2026-11-09).
- API evidence: `node scripts/audit_api.cjs` output (24/24 PASS).
- Error evidence: `node scripts/audit_error_handling.cjs` output (13/13 PASS).
- Model evidence: `GET /api/v1/predictions/performance`.
- Source evidence: `GET /api/v1/sources/status`.
- Backtest evidence: `GET /api/v1/predictions/backtesting?ticker=0700.HK` and the same endpoint for all 10 tickers.
- Pipeline evidence: `POST /api/v1/agents/run`, then `GET /api/v1/agents/status` and `GET /api/v1/ingestion/history`.

---

## 10. Reproduction Commands

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Ensure port 3000 is free (stop any other local dev server)
# 3. Start the app
npm run dev

# 4. In a second terminal:
node scripts/audit_api.cjs
node scripts/audit_error_handling.cjs
python -m unittest backend.tests.test_pipeline -v
npm run lint
npm run build

# 5. Optional responsive audit
npx playwright install chromium
node scripts/audit_responsive.cjs
```

Expected key results:

- API audit: `24 PASSED, 0 FAILED`
- Error handling: `13 PASSED, 0 FAILED`
- Python: `Ran 3 tests ... OK`
- Build: `✓ built`
- Pipeline: `success: true`, 7/7 integrity checks
- Ensemble: 48% DA, 1.07% MAPE, R² -2.100

---

## 11. Final Notes

- The submission now reports measured behavior rather than target numbers.
- The most important corrections are the live-feature fix, the DA/backtest alignment, unclipped R², measured pipeline metrics, and honest source labels.
- The remaining weaknesses are data realism and sample size, not hidden claims. They are disclosed above and in `README.md`.
