# Test Coverage & Code Quality Improvement Design

**Date:** 2026-02-20
**Approach:** Layer-by-layer (A) — Logic → Components → Code Quality

## Context

The project currently has:

- 246 bun unit tests across 13 files (all passing)
- 32 vitest component tests across 7 files
- 5 Playwright E2E test files

Key untested areas were identified via codebase analysis.

## Section 1 — Logic Layer (New Unit Tests)

### New files

**`src/lib/use-visualization-save.test.ts`** (bun test)

`createSaveHandler` tests:

- Prevents concurrent saves (`isSaving` guard)
- Aborts in-flight request when re-triggered
- Success flow: sets `saveSuccess=true`, closes dialog, resets after timer
- HTTP error flow: sets `saveError`, clears after timer
- `AbortError` is swallowed (no error state set)
- `cleanup()` cancels active timer and abort controller

`loadConfigFromUrl` tests:

- `configId` path: calls `loadSavedConfigParameters`, returns parameters + stability warnings
- `config` param path: calls `parseConfigParam`, returns parameters + stability warnings
- Abort signal triggers `{ok:'none'}` return
- Errors return `{ok:false, errors:[...]}`
- No params → `{ok:'none'}`

---

**`src/lib/use-visualization-share.test.ts`** (bun test)

`createShareHandler` tests:

- Success flow: returns `{shareUrl, expiresAt}`
- HTTP error: sets `shareError`, re-throws
- `AbortError` swallowed, returns `null`
- Concurrent share prevented by `isSharing` guard
- `cleanup()` aborts in-flight request

---

**`src/lib/stores/camera-sync.test.ts`** (bun test)

`cameraSyncStore` tests:

- `updateFromSide`: debounces updates, sets correct `lastUpdate`, sets `syncing=true` then resets to false
- Loop prevention: updates blocked when `syncing=true`
- `getStateForSide`: returns null when caller was last updater; returns other side's state otherwise
- `setEnabled(false)`: blocks `updateFromSide`
- `toggle()`: flips enabled state
- `reset()`: clears timers, resets to initial state

Helper functions:

- `createCameraState`: extracts position and target from Three.js-like objects
- `applyCameraState`: applies position and target via `.set()` calls and calls `controls.update()`

---

### Fix existing test

**`src/lib/server/share-utils.test.ts`**
Current problem: duplicates `generateShortCode` and `calculateExpirationDate` by copy-pasting source code.
Fix: import the actual functions from `$lib/server/share-utils` directly.

## Section 2 — Component Tests

### New behavior tests (`.vitest.ts`)

**`src/lib/components/ui/SaveConfigDialog.vitest.ts`**

- Empty name is blocked (submit button disabled)
- Name >100 chars shows error
- Valid submit calls `onSave` with trimmed name
- Unauthenticated state shows login link
- Cancel button calls `onClose`

**`src/lib/components/ui/DeleteConfirmDialog.vitest.ts`**

- Displays `configName` in confirmation text
- Cancel disabled while `isDeleting=true`
- Confirm button calls `onConfirm`
- Error prop is displayed when non-empty

**`src/lib/components/ui/ParameterSlider.vitest.ts`**

- Renders label and current value
- `change` / `input` event fires with correct numeric value

**`src/lib/components/ui/ShareDialog.vitest.ts`**

- Copy URL button is present
- Expiry date is displayed

**`src/lib/components/ui/ToastNotification.vitest.ts`**

- Renders message content
- Dismiss button calls the provided callback

### New smoke tests (`.vitest.ts`)

One test file per renderer, each testing:

1. Component renders without throwing
2. Accepts expected props without error
3. `onDestroy` / cleanup runs without errors

Renderers to cover:

- `HenonRenderer`
- `LogisticRenderer`
- `LorenzRenderer`
- `LyapunovRenderer`
- `NewtonRenderer`
- `RosslerRenderer`
- `BifurcationHenonRenderer`
- `BifurcationLogisticRenderer`
- `ChaosEsthetiqueRenderer`

## Section 3 — Code Quality

### Issues to fix alongside tests

1. **`share-utils.test.ts` copies source code** — import functions from the real module instead (see Section 1).

2. **`camera-sync.ts` duplicates debounce constant** — the store defines `const DEBOUNCE_MS = 120` locally while `CAMERA_SYNC_DEBOUNCE_MS = 120` already exists in `constants.ts`. Fix: remove the local constant and import `CAMERA_SYNC_DEBOUNCE_MS`.

3. **`save-config/+server.ts` auth and DB error paths are untested** — acceptable for now (requires integration test setup), but add `// TODO: add integration tests for auth, response format, DB errors` comments.

4. **`createSaveHandler` cleanup contract** — callers must call `cleanup()` on component destroy to prevent timer/abort leaks. Add explicit JSDoc warning.

## Implementation Order

1. Fix `share-utils.test.ts` (remove copied code, import from source)
2. Fix `camera-sync.ts` (use `CAMERA_SYNC_DEBOUNCE_MS` constant)
3. Write `use-visualization-save.test.ts`
4. Write `use-visualization-share.test.ts`
5. Write `stores/camera-sync.test.ts`
6. Write behavior tests for 5 UI components
7. Write smoke tests for 9 visualization renderers
8. Add TODO comments on untested API surface areas

## Success Criteria

- All new tests pass (`bun test` and `bun run test:unit`)
- `share-utils.test.ts` imports from real module (no duplicated source)
- `camera-sync.ts` uses centralized constant
- Zero new test failures introduced
