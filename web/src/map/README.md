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

We maintain a working micro-checklist in `route follower checklist.md`, including proposed contracts like `IRouteFollowerController` (controller/service) and route progress helpers, so the feature can be implemented against `IMapDisplay` and reused across raster + vector displays.

Navigation UX rule (reroute camera):

- If the user has taken control of the map (manual pan/zoom/tap cancels follow), reroutes update the route line + directions but **do not move the camera**.
- If follow-route is still enabled, reroutes keep the navigation camera behavior (no “show whole route” refit).

## Route following guardrails (current defaults)

These are demo-friendly heuristics (tune as needed; see `route follower checklist.md`):

- **Off-route detection**: `distanceToRouteMeters > 40m` for `>= 3` consecutive fixes, only when speed is at least `0.5 m/s`, with a `20s` reroute cooldown.
- **Progress stability**: distance-window search around last match (`50m` back, `200m` forward) with hysteresis (`switchMarginMeters = 10`) and backward jitter clamp (`maxBackwardProgressMetersPerFix = 3`).
- **Nav camera stability**: on some devices MapLibre throws internal errors during animated camera updates; follow-route uses a single `jumpTo({ center, zoom, pitch, bearing? })` when pitch (and optionally bearing) changes, then `easeTo` center-only updates while pitch and bearing are stable. **Bottom padding** from `NavCameraIntent` is still not applied on the raster path (deferred).

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

