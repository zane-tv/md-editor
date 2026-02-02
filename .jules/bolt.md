# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Component Definition in Render Loop

**Context:** Profiling App.tsx for re-renders.
**Discovery:** `ToolbarButton` was defined inside the `App` component function.
**Root Cause:** This caused React to treat it as a new component type on every render, forcing full unmount/remount of all toolbar buttons.
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx`.
**Applies To:** `src/App.tsx`
