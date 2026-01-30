# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2025-02-12 - ToolbarButton Optimization

**Context:** Profiling `App.tsx` for re-renders.
**Discovery:** `ToolbarButton` was defined inside the `App` component function.
**Root Cause:** React treats component definitions inside other components as *new* component types on every render, causing full unmount/remount cycles instead of updates.
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx` and wrapped in `React.memo`.
**Applies To:** `src/App.tsx`, React components in general.
