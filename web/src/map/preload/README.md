# `IPreloadService` (optional warmup)

Preloading is optional, but it is a clean way to improve the “first map use” experience without
mixing concerns into the page.

Examples:

- warm map sprites/fonts/style JSON
- fetch routing capabilities once and cache them
- run a lightweight health check so UI can show “routing offline”

## Proposed interface

```ts
export interface IPreloadService {
  preload(signal?: AbortSignal): Promise<void>
}
```

## DI points

- Inject into `MapPageController` as optional dependency.
- In tests, use a no-op implementation.

