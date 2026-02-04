# Bolt Journal

## 2024-05-22 - Initial Setup

**Context:** Initializing Bolt workspace.
**Discovery:** .jules/bolt.md did not exist.
**Action:** Created this file.
**Applies To:** Global

## 2024-05-22 - Extracted ToolbarButton to Prevent Remounting

**Context:** Optimizing App.tsx performance.
**Discovery:** ToolbarButton was defined inside the App component render function.
**Root Cause:** This caused the component to be redefined on every render (keystroke), leading to unnecessary unmounting and remounting of all toolbar buttons.
**Action:** Extracted ToolbarButton to src/components/ToolbarButton.tsx.
**Applies To:** src/App.tsx
