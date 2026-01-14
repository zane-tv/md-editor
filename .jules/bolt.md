# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Component Definition Inside Render Loop

**Context:** Optimizing `App.tsx` for typing performance.
**Discovery:** `ToolbarButton` component was defined *inside* the `App` component function.
**Root Cause:** React treats components defined inside render scope as new component types on every render, causing full unmount/remount cycles.
**Action:** Moved `ToolbarButton` definition to top-level module scope.
**Applies To:** `src/App.tsx`, React Components
