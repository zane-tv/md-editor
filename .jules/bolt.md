# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2026-01-13 - Component Definition in Render

**Context:** Investigating performance bottlenecks in `App.tsx`.
**Discovery:** `ToolbarButton` was defined inside the `App` component function.
**Root Cause:** React anti-pattern: defining components inside render creates a new component type on every render, forcing unmount/remount.
**Action:** Moved `ToolbarButton` definition to module scope.
**Applies To:** `src/App.tsx`, Component structure
