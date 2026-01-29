# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Nested Component Definition

**Context:** Profiling App.tsx for performance issues.
**Discovery:** `ToolbarButton` was defined inside the `App` component render function.
**Root Cause:** This causes the component to be redefined on every render, forcing React to unmount and remount it (DOM thrashing).
**Action:** Extracted `ToolbarButton` to a separate file and wrapped in `React.memo`.
**Applies To:** `src/App.tsx`
