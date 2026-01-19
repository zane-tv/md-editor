# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - App.tsx Component Definition Anti-pattern

**Context:** Profiling editor performance during typing.
**Discovery:** The `ToolbarButton` component was defined *inside* the `App` component's render function.
**Root Cause:** Defining components inside other components causes them to be recreated on every render, leading to full unmount/remount cycles instead of updates.
**Action:** Moved `ToolbarButton` outside `App` and wrapped in `memo`. Reduced mounts from ~400 to 0 during typing.
**Applies To:** `src/App.tsx` and potentially other React components.
