# gps (privacy-first routing demo)

This repo is an early **demo** for a privacy-first routing experience: help a user get directions **without requiring them to send precise geolocation** to an upstream provider if they want to keep that data private.

Today, the demo is a small React app that runs locally. Longer-term we may swap providers, add offline/self-hosted options, and improve navigation features, but we are **not committing to a detailed roadmap past the demo** yet.

## Privacy goal (high level)

Many routing experiences require sharing precise location with third parties (geocoders, routing engines, map tile providers). This project’s basic goal is to:

- Keep the product usable even when the user does **not** want to share precise location upstream.
- Make it clear which parts of the system might contact upstream services (and allow replacing them later).

The demo may still use public services while we validate UX and architecture; the intent is to make those dependencies **swappable**.

## What’s in here

- `web/`: the **React + TypeScript + Vite** app (the thing you run and test in the browser/phone).
- Root `*_notes.md` and `project_checklist.md`: design notes and progress tracking for the demo.

## Demo vs later goals

- **Demo**:
  - Interactive map page (`/map`)
  - “Center on me” and live location marker (browser geolocation)
  - Simple routing and route display on the map
  - A few UX experiments (direction wedge, trip stop ordering, etc.)
- **Later (not a locked roadmap)**:
  - Stronger privacy controls and clearer data-flow choices
  - Replace or self-host upstream services (routing/geocoding/tiles) where possible
  - Navigation/follow-route, rerouting, richer routing profiles, etc.

## Run locally

From the repo root:

```bash
cd web
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Test on an Android phone

Two common options:

- **Same Wi‑Fi (LAN)**:
  - Run `npm run dev -- --host` in `web/`
  - Open the **Network** URL Vite prints on your phone (e.g. `http://192.168.x.x:5173`)
- **USB (ADB reverse)**:
  - `adb reverse tcp:5173 tcp:5173`
  - On the phone open `http://127.0.0.1:5173`

