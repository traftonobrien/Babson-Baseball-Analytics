# RE288 Scraper Development Checklist

## 🚀 Phase 1: Foundation & Testing
- [x] Create project directory structure (`re288/docs`, `re288/src`)
- [x] Migrate existing scraper logic to `re288/src`
- [x] Create Architecture Documentation
- [x] Setup Vitest environment within the `re288` context
- [x] Add native `re288` CLI entrypoint and manifest workflow

## 🏟️ Phase 2: Conference Expansion (The "Canonical" Path)
*Goal: Move from single-conference scraping to a registry-driven pipeline.*

### NEWMAC (Current Baseline)
- [x] Validate NEWMAC scraper integrity in new environment
- [x] Document NEWMAC Sidearm URL patterns
- [x] Build stable NEWMAC canonical game index artifact

### Target Conferences (To be integrated)
- [x] NESCAC registry starter pack
- [x] Liberty League registry starter pack
- [ ] Conference C

## 🏗️ Phase 3: Canonical Game Index (CGI) Implementation
- [x] Design CGI Data Schema (Unique Game ID, Date, Opponent, Sidearm ID)
- [x] Implement "Registry" service (Conference/program mapping)
- [x] Build Deduplication Engine (Registry + Scraper -> CGI)
- [x] Normalize mirrored schedule noise (`Noon`, timezone suffixes, ranked labels)
- [x] Add pooled canonical index output for multi-conference manifests

## 📥 Phase 4: Standalone PBP Ingestion
- [x] Build raw Sidearm PBP parser
- [x] Build deterministic fetch/provenance layer
- [x] Build standalone PBP corpus CLI
- [x] Validate NEWMAC PBP corpus build
- [x] Validate Liberty League PBP corpus build
- [x] Validate NESCAC PBP corpus build
- [x] Build pooled starter-pack PBP corpus
- [ ] Integrate standalone corpus with RE Matrix generation

## 🧪 Quality Assurance
- [x] Implement scraper regression tests
- [x] Implement PBP parser / fetch tests
- [x] Verify executable NEWMAC index build from CLI
- [x] Verify manifest-driven starter-pack pooling
- [ ] Validate PBP extraction accuracy against manual samples
- [ ] Verify "Canonical ID" stability across multiple scrapes
