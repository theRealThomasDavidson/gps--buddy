# Map architecture (interfaces + DI)

This folder defines the **contracts** that power the `/map` screen.

The goal is to keep the UI SOLID:

- `MapPage` coordinates user flow, but does **not** implement mapping or routing.
- Concrete implementations (MapLibre, OSRM, ORS, etc.) live behind **interfaces**.
- We can swap implementations without rewriting `MapPage`.

## Modules

- `display/` — render a map and draw overlays (position, routes, markers); `ThumbtackPinGenerator` for named thumbtack cap colors (e.g. `yellow`)
- `location/` — obtain device location (one-shot + watch)
- `geocoding/` — text → coordinates (`IGeocoder`)
- `routing/` — `IRoutingService` + demo **`OsrmRoutingService`** (`createDefaultRoutingService`)
- `evaluation/` — compute metrics and quality checks on returned routes
- `preload/` — optional warming/preload of map assets or provider capabilities
- `types.ts` — shared types used across contracts

## Dependency inversion boundary

`MapPage` (and a future `MapPageController`) should depend only on:

- `IMapDisplay`
- `ILocation`
- `IGeocoder`
- `IRoutingService`
- `IRouteEvaluator`
- optional `IPreloadService`

Concrete classes are created in a **composition root** (e.g. `src/map/di.ts` later)
and injected into the page/controller.

