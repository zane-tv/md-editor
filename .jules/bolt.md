# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - ToolbarButton Component Definition

**Context:** Optimizing `App.tsx` render performance.
**Discovery:** `ToolbarButton` was defined inside the `App` component body.
**Root Cause:** Defining components inside others creates a new component type on every render, causing full unmount/remount cycles.
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx` and wrapped in `React.memo`.
**Applies To:** React components, specifically `App.tsx`.
