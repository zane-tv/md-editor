# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - App.tsx Toolbar Optimization

**Context:** Investigating `src/App.tsx` for re-render performance issues.
**Discovery:** `ToolbarButton` was defined *inside* the `App` component function, causing it to be recreated (and thus unmounted/remounted) on every keystroke. This contradicted the initial memory.
**Root Cause:** Component definition inside render scope.
**Action:** Extracted `ToolbarButton` to module scope and wrapped in `React.memo`.
**Applies To:** `src/App.tsx`
