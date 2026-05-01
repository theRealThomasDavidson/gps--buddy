# `units/` (distance conversions + formatting)

This module centralizes **distance conversions** and **formatting** so UI and voice guidance share one source of truth.

## `Units` map

`Units` defines both the **unit names** and the **conversion constants**.

- `distance.close`: “short range” unit (used for near maneuvers)
  - `Imperial.value`: **yards per meter** (multiply meters → yards)
  - `Metric.value`: **meters per meter** (`1.0`)
- `distance.far`: “long range” unit (used for longer distances)
  - `Imperial.value`: **meters per mile** (divide meters → miles)
  - `Metric.value`: **meters per kilometer** (divide meters → kilometers)

## Formatters

- `imperialDistanceFormatter`: UI uses `yd` / `mi`; voice uses “yards” / “miles” (with “half a mile” special-case).
- `metricDistanceFormatter`: UI uses `m` / `km`; voice uses “meters” / “kilometers”.

