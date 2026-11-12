# QA REPORT — SUPERSEDED

> **This file previously contained unverified PASS claims (including 23/23 endpoints, PostgreSQL, live Apify orchestration, and a 73.4% ML accuracy figure) that do not match the implementation. It has been replaced to avoid submitting false evidence.**

The authoritative audit is `FINAL_SUBMISSION_REPORT.md`, backed by executed checks:

| Check | Current Result |
| :--- | :--- |
| API contract audit | 24/24 PASS (`node scripts/audit_api.cjs`) |
| Error handling / fallback truthfulness | 13/13 PASS (`node scripts/audit_error_handling.cjs`) |
| Python pipeline unit tests | 3/3 OK (`python -m unittest backend.tests.test_pipeline -v`) |
| TypeScript typecheck | PASS (`npm run lint`) |
| Production build | PASS (`npm run build`) |
| Persistence | In-memory seeded stores; no PostgreSQL/Redis |
| Apify | Not wired; social data always `local-fallback` |
| Exa | Live only when `EXA_API_KEY` is set; otherwise `local-fallback` |
| ML sample | 5 walk-forward folds × 10 assets = 50 OOS observations |
| Deployed ensemble directional accuracy | 48% |
| Deployed ensemble OOS R² | -2.100 (unclipped) |

See `FINAL_SUBMISSION_REPORT.md` and `README.md` for current metrics, limitations, and reproduction commands.
