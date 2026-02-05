# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Extracted ToolbarButton

**Context:** Profiling App.tsx for re-renders.
**Discovery:** `ToolbarButton` was defined inside the `App` component, causing ~20 buttons to unmount/remount on every keystroke (since `App` state updates on keystroke).
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx`.
**Applies To:** `src/App.tsx`, `src/components/ToolbarButton.tsx`
