# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-23 - Nested Component Definitions in Render Loop

**Context:** Profiling `App.tsx` for re-render issues.
**Discovery:** `ToolbarButton` was defined *inside* the `App` component function. This causes the component function to be recreated on every render of `App`, forcing React to unmount and remount the DOM for all toolbar buttons on every keystroke.
**Root Cause:** Developer convenience/oversight during initial implementation.
**Action:** Extracted the component to module scope and memoized it. Future reviews should grep for `const .* = \(\{` inside functional components.
**Applies To:** `src/App.tsx` and potential future React components.
