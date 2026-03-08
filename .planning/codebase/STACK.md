# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- Python 3.11-ish runtime expectations for data pipelines, CV scripts, and operational tooling under `src/` and `scripts/`
- TypeScript 5.x for the Next.js portal in `web/`

**Secondary:**
- SQL migrations in `web/drizzle/`
- Markdown-heavy docs and planning files in `docs/` and `.planning/`
- JSON/CSV as first-class data interchange formats in `web/public/`, `data/`, and `outings/`

## Runtime

**Environment:**
- Node.js for the web app, build tooling, and Drizzle CLI
- Python virtualenv-based workflow for CV, ingest, and stats scripts
- Browser runtime for the Next.js client surfaces

**Package Manager:**
- npm with lockfiles at repo root and `web/package-lock.json`
- Python dependencies tracked in `requirements.txt`

## Frameworks

**Core:**
- Next.js 16.1.6 in `web/` for the portal UI and route handlers
- React 19.2.3 for client and server components
- Tailwind CSS 4 for styling
- Drizzle ORM + Drizzle Kit for the small dynamic Postgres layer

**Data / ML / CV:**
- PyTorch + torchvision + `sam2` for pitch-command video analysis
- OpenCV and NumPy for frame/image processing
- MediaPipe for mechanics pose extraction

**Testing:**
- Pytest for Python modules and scripts
- Vitest for TypeScript library tests in `web/lib/**/*.test.ts`
- Playwright is installed in Python requirements for browser automation workflows

## Key Dependencies

**Critical:**
- `@neondatabase/serverless` - Neon Postgres access from Next.js server code
- `drizzle-orm` / `drizzle-kit` - schema definition and migrations for dynamic web data
- `papaparse` - CSV loading/parsing in the web app
- `lucide-react`, `motion`, `framer-motion` - current portal UI primitives and motion
- `sam2`, `torch`, `opencv-python`, `mediapipe` - core baseball-analysis pipeline dependencies

**Infrastructure:**
- `dotenv` in `web/drizzle.config.ts` for local DB configuration
- `eslint` + `eslint-config-next` for web linting
- GitHub Actions for the daily D3 sync workflow in `.github/workflows/sync-d3-daily.yml`

## Configuration

**Environment:**
- Web DB access expects `DATABASE_URL` via `web/.env.local`
- Internal password gates use `PT_PASSWORD` and `MECHANICS_PASSWORD`
- D3 dashboard proxy expects `D3_DASHBOARD_API_KEY`
- Python pipeline behavior also depends on local assets such as `config.yaml`, `camera_calibration.json`, model files, and source videos

**Build:**
- Root `package.json` exists mainly to resolve Tailwind/PostCSS for the workspace
- `web/next.config.ts`, `web/tsconfig.json`, `web/eslint.config.mjs`, `web/vitest.config.mts`, and `web/drizzle.config.ts` are the main web config files
- `pytest.ini` sets Python test discovery

## Platform Requirements

**Development:**
- macOS-like local environment is assumed in docs and scripts
- Local Python environment with CV/ML dependencies installed
- Local Node/npm environment for `web/`
- Large local asset folders are part of normal development (`outings/`, `Mechanics Analysis/`, `web/public/data/`)

**Production:**
- The current portal is optimized for Vercel-style Next.js hosting plus Neon for dynamic reads
- Much of the site still serves committed static JSON/CSV/media from `web/public/`
- Daily D3 sync is handled by GitHub Actions rather than an always-on backend

---
*Stack analysis: 2026-03-06*
*Update after major dependency changes*
