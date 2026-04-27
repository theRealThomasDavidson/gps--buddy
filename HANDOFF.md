# Handoff (next agent)
Date: 2026-04-26

This file captures current project state + what to do next.

## Current status
- **App**: React + TypeScript + Vite in `web/`
- **Routes**: `/`, `/map`, `/options`
- **Directions UI**: `/map` shows a Directions list (turn-by-turn step text + distance) for the active route
- **Trip stops reorder**: drag the “hamburger” grip to reorder stops
- **Direction indicator**: user marker has a yellow wedge in the dark-blue ring that rotates with bearing  
  - There’s a debug flag in `web/src/map/display/RasterTileMapDisplay.ts`
- **Phone testing**: dev server uses `{ host: true }` in `web/vite.config.ts` so `127.0.0.1` + `adb reverse` works
- **Location refactor**: location is now one interface + one class
  - `web/src/map/location/ILocation.ts` (interface)
  - `web/src/map/location/BrowserLocation.ts` (implementation)
  - `MapPage` uses `BrowserLocation` for both one-shot and watch
- **Tests**: Vitest is set up and passing

## What changed recently (key files)
### Routing steps
- `web/src/map/types.ts` (`Route.steps?: RouteDirectionStep[]`)
- `web/src/map/routing/OsrmRoutingService.ts`
  - Uses `steps=true`
  - Normalizes instructions
- `web/src/pages/MapPage.tsx` renders Directions list
- `web/src/pages/pages.css` styles Directions

### Testing and coverage tooling
- `web/vite.config.ts` imports from `vitest/config` and has `test` + coverage config
- `web/package.json` scripts: `test`, `test:watch`, `test:coverage`
- Coverage is enabled via v8; reports written to `web/coverage/` (HTML + lcov)
- Coverage-related test improvements live under `web/src/map/**/**/*.test.ts` (notably `RasterTileMapDisplay.test.ts`)

## Important notes / constraints
- Root `project_checklist.md` is currently ignored by `.gitignore` (because it matches `*checklist.md`). It was still updated for local tracking.
- There is a helper script `web/tmp_fetch_osrm.mjs` used to find a roundabout route.
  - Decide whether to delete it, or move it to a proper `scripts/` location and ensure it’s ignored.

## Tomorrow’s task: lints + cleanup
Focus areas:
- Run lint and fix issues.
- Remove or ignore temporary/demo scripts you don’t want tracked (notably `web/tmp_fetch_osrm.mjs`).
- Optionally tighten test types if lint complains about things like `unknown as Partial<Navigator>`.
- Re-run tests and coverage after lint fixes.

## Quick commands
```bash
cd web
npm run dev
```

```bash
cd web
npm test
```

```bash
cd web
npm run test:coverage
```

```bash
cd web
npm run lint
```

