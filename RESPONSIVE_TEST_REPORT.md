# RESPONSIVE TEST REPORT — HengSeng Sentiment Price Prediction Agent

**Report date:** 2026-11-13  
**Application:** HengSeng Sentiment Price Prediction Agent  
**Viewport strategy:** Mobile-first; every page built with Tailwind responsive utilities

---

## 1. Mandatory Viewport Targets

| Viewport | Width × Height | Category |
|----------|----------------|----------|
| 1 | 320 × 568 | Mobile (small) |
| 2 | 360 × 800 | Mobile |
| 3 | 375 × 812 | Mobile (iPhone SE/12 mini) |
| 4 | 390 × 844 | Mobile (iPhone 12/13/14) |
| 5 | 412 × 915 | Mobile (Pixel) |
| 6 | 430 × 932 | Mobile |
| 7 | 768 × 1024 | Tablet (portrait) |
| 8 | 1024 × 768 | Tablet / laptop |
| 9 | 1280 × 800 | Laptop / desktop |
| 10 | 1440 × 900 | Desktop |
| 11 | 1920 × 1080 | Desktop (wide) |

---

## 2. Responsive Requirements Implemented

| Requirement | Implementation |
|-------------|----------------|
| No page-level horizontal scrolling | All layouts use `max-w-7xl mx-auto w-full`; tables wrapped in `overflow-x-auto` containers only; no fixed widths that exceed viewport |
| No clipped/overlapping/hidden/overflowing content | Tailwind `break-words`, `truncate`, `min-w-0` on flex children, responsive padding (`p-4 sm:p-6 md:p-8`) |
| Responsive navigation + mobile drawer | Hamburger (`lg:hidden`) opens a full-height side drawer; drawer closes on navigation selection and on backdrop click |
| Drawer closes after navigation | Every nav button calls `setMobileMenuOpen(false)`; overlay backdrop click also closes |
| Forms adapt to narrow screens | LoginView is a centered `max-w-md` card on stack; inputs full-width `w-full`; stack layout on mobile |
| Tables use container scrolling | Asset tables, leaderboards, backtesting tables use `overflow-x-auto` wrappers |
| Cards, charts, dialogs, menus, buttons adapt | Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`; Recharts `ResponsiveContainer`; dropdowns use `absolute` positioning with `max-h` overflow |
| No fixed widths breaking mobile | Replaced fixed `w-56` overflow menu with `w-[260px]` + `max-h-[85vh] overflow-y-auto`; mobile drawer `max-w-[85vw]` |
| Readable typography / touch targets | Responsive text sizes (`text-xs sm:text-sm`), min 44px touch targets, high-contrast colors in light + dark themes |

---

## 3. Per-Page Coverage

All pages verified for responsive structure (class-level inspection):

- Overview (metric strip, sentiment polarity chart, forecast leaders)
- Exchange Intel (asset grid + exchange filter)
- Asset Rankings (responsive table + cards)
- Price Predictions (asset list + detail modal)
- Model Validation (leaderboard table)
- Backtesting Lab (per-ticker backtest table)
- Executive Reports (report cards + export)
- Data Registry (source status meta table)
- Pipeline Monitor (agent cards)
- Settings & Keys (settings form + user management)
- Social Sentiment / News Intelligence (list views)
- Asset Detail Modal (drawer with sub-tabs)

---

## 4. Test Execution Status

**Rendered-browser responsive screenshots:** NOT regenerated in this pass.

**Blocker:** Playwright Chromium cannot launch in this environment. `chromium.launch()` fails with `OS access denied` (exit code `0x80000005` / `2147483651`) even when passing `--no-sandbox`, `--disable-gpu`, `--disable-dev-shm-usage`, `--single-process`, `--no-zygote`. Standalone Chromium launches correctly with `--no-sandbox`, confirming the restriction is imposed on Playwright's spawned browser process by the host sandbox, not by the application.

**What was verified instead:**
- All responsive Tailwind classes present and correct across every component (source-level audit)
- API-layer E2E tests (10) pass on desktop and mobile project configurations via Playwright `request` (no rendered browser needed)
- No horizontal-scroll-producing fixed widths found in any component

**To complete rendered-browser verification:** Run on a host with Chrome access:

```bash
npx playwright install chromium
npx playwright test --project="chromium-mobile" --project="chromium-desktop"
```

The `playwright.config.ts` already defines both `chromium-mobile` (Pixel 5) and `chromium-desktop` projects and `tests/e2e/app.spec.ts` includes a mobile-drawer test.

---

## 5. Known Responsive Notes

- Desktop three-dot overflow menu now renders ALL navigation items (was limited to secondary tabs); mobile drawer already rendered all grouped items.
- Overview "Cross-Asset Sentiment Polarity" chart includes a high-contrast always-visible Sentiment Range readout, readable in both light (`#0b0f17` dark / `slate-50` light) and dark themes.
- Dark/light theme toggle present in top bar and mobile drawer; `dark:` variants used throughout.

---

## 6. Sign-off

Layout is mobile-first and responsive across all required viewports at the code level. Rendered screenshot confirmation is pending an environment with Chrome access (documented blocker; not an application defect).
