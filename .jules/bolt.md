# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Component Definition Inside Render Loop

**Context:** Profiling `App.tsx` for performance bottlenecks.
**Discovery:** `ToolbarButton` was defined inside the `App` component function.
**Root Cause:** This causes the component function to be recreated on every render (keystroke), forcing React to unmount and remount all toolbar buttons, leading to high reconciliation cost.
**Action:** Extracted `ToolbarButton` to module scope and wrapped in `React.memo`.
**Applies To:** `src/App.tsx`, and potentially other large components.
