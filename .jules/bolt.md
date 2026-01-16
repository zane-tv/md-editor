# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - App.tsx Optimization

**Context:** Profiling App.tsx for performance improvements.
**Discovery:** `ToolbarButton` was defined inside `App` component.
**Root Cause:** Component definition inside render function causing unmount/remount on every state change (keystroke).
**Action:** Moved `ToolbarButton` outside of `App`.
**Applies To:** src/App.tsx
