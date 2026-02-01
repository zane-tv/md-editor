# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Toolbar Re-rendering Optimization

**Context:** Optimizing `App.tsx` for typing performance.
**Discovery:** `ToolbarButton` was defined *inside* the `App` component.
**Root Cause:** React component definitions inside other components cause the inner component to be re-created (new function reference) on every parent render. This forces React to unmount the old instance and mount a new one, destroying state and causing DOM thrashing.
**Action:** Extracted `ToolbarButton` to `src/components/ToolbarButton.tsx`. Also optimized `insertText` to read from ref instead of state to allow for stable callbacks.
**Applies To:** `App.tsx`, React Components
