# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Nested Component Anti-Pattern

**Context:** Profiling `App.tsx` for unnecessary re-renders.
**Discovery:** `ToolbarButton` was defined inside the `App` component function.
**Root Cause:** Defining components inside other components creates a new component type on every render, causing unmount/remount cycles.
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx`.
**Applies To:** React Components
