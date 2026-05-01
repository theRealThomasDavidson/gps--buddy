# `IRoutingService` (provider contract)

`IRoutingService` is responsible for **calling a routing backend** and returning a normalized `Route`.

This contract keeps provider-specific details (endpoints, auth, response formats)
out of UI code.

## Responsibilities

- Accept a `RouteRequest` (profile + waypoints + avoid options)
- Support cancellation (via `AbortSignal`) to avoid races
- Normalize provider response into app `Route` type

## Route rendering policy (workflow)

`IRoutingService` intentionally returns **data only** (a `Route`). Rendering policy lives in a small routing-owned workflow:

- `IRouteWorkflow` + `RouteWorkflow`:
  - calls `router.route(...)`
  - then renders via `IMapDisplay.showRoute(route)`
  - optionally frames via `IMapDisplay.fitRoute(route)` (planning view)
  - clears via `IMapDisplay.showRoute(null)`

This keeps provider implementations UI-agnostic while centralizing **show/fit/clear** in one place.

## Proposed interface

```ts
import type { Route, RouteRequest } from '../types'

export interface IRoutingService {
  readonly id: string
  route(request: RouteRequest, signal?: AbortSignal): Promise<Route>
}
```

## Capabilities (optional, but useful)

If different providers support different profiles/options, expose them explicitly:

```ts
import type { RouteProfile } from '../types'

export type RoutingCapabilities = {
  profiles: RouteProfile[]
  supportsAvoidHighways?: boolean
  supportsAvoidTolls?: boolean
  supportsAvoidFerries?: boolean
  maxWaypoints?: number
}

export interface IRoutingServiceWithCapabilities extends IRoutingService {
  capabilities(signal?: AbortSignal): Promise<RoutingCapabilities>
}
```

## DI points

- `MapPage` should not know *which* provider it is using.
- A future options setting can choose one provider implementation at runtime.
- Tests can inject a `FakeRoutingService` that returns canned routes.

## Implementations (web)

- **`IRoutingService`** — `IRoutingService.ts`
- **`ValhallaRoutingService`** — `ValhallaRoutingService.ts` POSTs to the public **Valhalla** host `valhalla1.openstreetmap.de` (FOSSGIS). Returns polyline6 geometry (decoded in-app). Development only; no API key; see [FOSSGIS Valhalla announcement](https://www.fossgis.de/news/2021-11-12_funding_valhalla/).
- **`decodePolyline6`** — `decodePolyline6.ts` decodes Valhalla’s default **polyline6** leg shapes into `LngLat[]`.
- **`OsrmRoutingService`** — `OsrmRoutingService.ts` remains available for experiments (public OSRM demo); not used by `createDefaultRoutingService()`.
- **`createDefaultRoutingService()`** — `createRoutingService.ts` returns the FOSSGIS Valhalla client.

`MapPage` builds a `RouteRequest` (e.g. me → pinned, `profile: 'drive'`), calls `router.route(...)`, then `IMapDisplay.showRoute(route)`.

