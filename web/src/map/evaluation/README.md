# `IRouteEvaluator` (route metrics & quality)

`IRouteEvaluator` computes **metrics** and **quality checks** for a route returned by a router.

The app can use evaluation to:

- show distance/duration even if the provider omits it
- compute a simple score to pick among alternatives
- flag properties like “contains ferry” or “too many turns”

## Proposed interface

```ts
import type { Route, RouteEvaluation } from '../types'

export type EvalContext = {
  now?: Date
}

export interface IRouteEvaluator {
  evaluate(route: Route, context?: EvalContext): RouteEvaluation
}
```

## DI points

- The evaluator is injectable so we can experiment with scoring without touching the router implementation.
- A “basic” evaluator can just pass through `distanceMeters`/`durationSeconds` when present.

## Route progress (map-matching lite)

For the demo route-following stories, we also keep a **pure math** contract in `evaluation/` that can be reused across raster/vector map displays:

- `IRouteProgressor` (`IRouteProgressor.ts`) projects a live `LocationFix` onto a route polyline:
  - returns `{ snappedCoords, segmentIndex, metersAlongRoute, distanceToRouteMeters }`
  - accepts/returns a small `memory` object to support stable selection across fixes
- `BasicRouteProgressor` (`BasicRouteProgressor.ts`) is the demo implementation:
  - **distance-window** search around the last match (meters, not segment count)
  - **hysteresis** (`switchMarginMeters`) to avoid switching between nearly-equal segments
  - **backward clamp** (`maxBackwardProgressMetersPerFix`) to reduce GPS jitter oscillation

