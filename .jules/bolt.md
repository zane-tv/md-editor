# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Toolbar Performance Optimization

**Context:** Optimizing `App.tsx` rendering performance.
**Discovery:** `ToolbarButton` was defined inside `App` component, causing unmount/remount of all 15+ toolbar buttons on every keystroke.
**Root Cause:** Component definition inside render loop.
**Action:** Extracted `ToolbarButton` to external file and memoized it. Also optimized `insertText` to read from ref instead of state to stabilize handlers.
**Applies To:** `src/App.tsx`, Rendering Performance
