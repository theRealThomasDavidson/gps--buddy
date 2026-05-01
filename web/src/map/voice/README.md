# `voice/` (demo voice guidance)

This folder holds the **voice guidance** contracts and web implementations for the `/map` demo.

## Contracts

- `IVoiceGuidance`: minimal interface for speaking short navigation prompts.
  - Web implementation: `WebSpeechVoiceGuidance` (uses the browser `SpeechSynthesis` API).

## Usage pattern (demo-safe)

- Treat voice as **optional** and **best-effort**:
  - If unsupported, no-op.
  - For navigation, prefer `mode: 'replace'` so stale prompts do not queue up.

