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

## Hard next: progress on the route + live next direction

Parts of this already show up indirectly (routing, directions list, deviation ideas in evaluation), but two capabilities are explicit product goals and are likely the **hardest** work ahead:

1. **Where you are on the route** — Project live GPS onto the planned polyline (segment index, distance along line, optional traversed vs remaining styling). Needs a small, testable geometry helper and a clear contract before `MapPage` wires watch updates.
2. **Next direction while moving** — Advance beyond the static OSRM step list: pick **current / next** maneuver from position along the route + step geometries, with UI that highlights the upcoming turn (voice is out of scope until this is solid).

Design notes and checkboxes live in **`project_checklist.md`** (Demo user stories). When we add APIs (e.g. snap/progress or a navigation facade), document them here and in `routing/` / `evaluation/` READMEs as appropriate.

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

