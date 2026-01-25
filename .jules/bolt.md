# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Performance Optimization

**Context:** Profiling `src/App.tsx` for performance bottlenecks.
**Discovery:** `ToolbarButton` was defined inside the `App` component, causing all toolbar buttons to unmount and remount on every keystroke (re-render of `App`).
**Root Cause:** Component definition inside render scope.
**Action:** Extracted `ToolbarButton` to module scope and wrapped in `React.memo`. Also optimized `insertText` to remove state dependency, enabling better stability.
**Applies To:** `src/App.tsx`, Editor Toolbar.
