# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Component Extraction Performance

**Context:** Profiling `App.tsx` for performance bottlenecks.
**Discovery:** `ToolbarButton` was defined inside the `App` component function.
**Root Cause:** Defining components inside render functions causes them to be treated as new component types on every render, forcing React to unmount and remount them (and their DOM nodes).
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx` and memoized it. Also extracted `CodeBlock` for consistency.
**Applies To:** `src/App.tsx` rendering loop.
