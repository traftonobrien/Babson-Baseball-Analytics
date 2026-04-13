# Conference Registry Reference

This is the current starter pack of conference registries that the standalone `re288/` workspace can build today.

## Runnable Today

### NEWMAC
- JSON: `/Users/traftonobrien/Desktop/pitch-tracker/re288/config/data_sources/newmac_baseball_programs.json`
- Registry id: `newmac`
- Programs: 9
- Notes: fully normalized and already validated through the canonical game index builder

### NESCAC
- JSON: `/Users/traftonobrien/Desktop/pitch-tracker/re288/config/data_sources/nescac_baseball_programs.json`
- Registry id: `nescac`
- Programs: 10
- Verified schedule hosts:
  - Amherst: `https://athletics.amherst.edu`
  - Bates: `https://gobatesbobcats.com`
  - Bowdoin: `https://athletics.bowdoin.edu`
  - Colby: `https://colbyathletics.com`
  - Hamilton: `https://athletics.hamilton.edu`
  - Middlebury: `https://athletics.middlebury.edu`
  - Trinity (Conn.): `https://bantamsports.com`
  - Tufts: `https://gotuftsjumbos.com`
  - Wesleyan: `https://athletics.wesleyan.edu`
  - Williams: `https://ephsports.williams.edu`

### Liberty League
- JSON: `/Users/traftonobrien/Desktop/pitch-tracker/re288/config/data_sources/liberty_league_baseball_programs.json`
- Registry id: `liberty-league`
- Programs: 11
- Verified schedule hosts:
  - Bard: `https://bardathletics.com`
  - Clarkson: `https://clarksonathletics.com`
  - Hobart: `https://hwsathletics.com`
  - Ithaca: `https://athletics.ithaca.edu`
  - Rensselaer: `https://rpiathletics.com`
  - RIT: `https://ritathletics.com`
  - Rochester: `https://uofrathletics.com`
  - Skidmore: `https://skidmoreathletics.com`
  - St. Lawrence: `https://saintsathletics.com`
  - Union: `https://unionathletics.com`
  - Vassar: `https://www.vassarathletics.com`

## Build Commands

From `/Users/traftonobrien/Desktop/pitch-tracker/re288`:

```bash
npm run build:index:newmac
npm run build:index:nescac
npm run build:index:liberty-league
npm run build:pbp:newmac
npm run build:pbp:nescac
npm run build:pbp:liberty-league
npm run build:pool:starter-pack
```

Starter-pack manifest:

- JSON: `/Users/traftonobrien/Desktop/pitch-tracker/re288/manifests/starter-pack-2026.json`
- Pool id: `starter-pack`
- Conferences:
  - `newmac`
  - `nescac`
  - `liberty-league`

Native CLI equivalents:

```bash
node ./bin/re288.mjs manifest validate --file manifests/starter-pack-2026.json
node ./bin/re288.mjs pool build --manifest manifests/starter-pack-2026.json
node ./bin/re288.mjs master update --manifest manifests/starter-pack-2026.json
```

## Expansion Pattern
When adding another conference:
1. create a `*_baseball_programs.json` file under `config/data_sources/`
2. register it in `src/registry.ts`
3. run the generic index build
4. spot-check mirrored conference games before treating the index as stable
