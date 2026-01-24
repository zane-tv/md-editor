# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Component Definition Inside Component Anti-Pattern

**Context:** Profiling `src/App.tsx` for performance opportunities.
**Discovery:** The `ToolbarButton` component was defined *inside* the `App` component function. This causes the component to be redefined on every render, forcing React to unmount and remount all toolbar buttons on every keystroke.
**Root Cause:** Developer convenience or lack of awareness of the anti-pattern.
**Action:** Moved `ToolbarButton` to module scope and wrapped in `React.memo`. Also optimized `insertText` to use `ref` to avoid state dependencies.
**Applies To:** React Components
