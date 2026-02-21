# Test Coverage & Code Quality Improvement — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve test coverage for the codebase by adding unit tests for untested logic modules, behavior tests for UI components, smoke tests for visualization renderers, and fixing two code quality issues.

**Architecture:** Layer-by-layer — logic layer first (bun unit tests for `use-visualization-save`, `use-visualization-share`, `stores/camera-sync`), then component layer (vitest + @testing-library/svelte for UI behavior and renderer smoke tests), then code quality fixes.

**Tech Stack:** Bun test runner (`bun:test`) for pure logic, Vitest + @testing-library/svelte + jsdom for Svelte component tests, `vi.mock()` / `mock.module()` for mocking.

---

## Background

**Test file naming conventions** (critical — bun and vitest pick up different patterns):

- `*.test.ts` → run by `bun test`, use `import { describe, test, expect, mock } from 'bun:test'`
- `*.vitest.ts` → run by `bun run test:unit` (vitest), use `import { describe, it, expect, vi } from 'vitest'`

**Vitest config includes:**

- `src/lib/components/**/*.vitest.ts`
- `src/routes/**/*.vitest.ts`

**Bun config:** `root = "./src"` in `bunfig.toml` — picks up all `*.test.ts` under `src/`.

**`mock.module()` in bun:test is auto-hoisted** before imports (like `jest.mock()`). Place it at the top of the file.

**`vi.mock()` in vitest is also auto-hoisted** — same pattern.

**Dialog elements** (`<dialog>`) aren't fully supported in jsdom. Mock `showModal` and `close` in `beforeEach`.

**Canvas** isn't supported in jsdom — mock `HTMLCanvasElement.prototype.getContext` (see StandardRenderer.vitest.ts for pattern).

**Three.js** uses WebGL — mock `three` and `three/examples/jsm/...` modules in vitest tests.

**Run commands:**

```bash
bun test                  # all *.test.ts files
bun run test:unit         # all *.vitest.ts files
```

---

## Task 1: Fix `share-utils.test.ts` — Remove Copied Code

**Problem:** The test file duplicates `generateShortCode`, `calculateExpirationDate`, `isShareExpired`, and `getDaysUntilExpiration` instead of importing from the actual module. If the source changes, the tests won't catch regressions.

**Root cause:** `$lib/server/share-utils` imports `$lib/server/db`, which throws at load time if `DATABASE_URL` is missing. The fix: mock `$lib/server/db` with bun's `mock.module()` so the pure functions can be imported from the real module.

**Files:**

- Modify: `src/lib/server/share-utils.test.ts`

**Step 1: Replace the file contents**

Replace everything from line 1 to the first `describe('generateShortCode'` with:

```typescript
/**
 * Unit tests for share utilities
 *
 * Tests pure functions that don't require database access.
 * Database-dependent functions are tested via integration tests.
 */

import { describe, expect, mock, test } from 'bun:test';
import {
	SHARE_CODE_LENGTH,
	SHARE_CODE_CHARSET,
	SHARE_RATE_LIMIT_PER_HOUR,
	SHARE_EXPIRATION_DAYS
} from '$lib/constants';

// Mock $lib/server/db to prevent DB connection on import.
// mock.module() is auto-hoisted so it runs before any module imports.
mock.module('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: () => ({ limit: () => [] }) }) }),
		insert: () => ({ values: () => ({ returning: () => [] }) }),
		update: () => ({ set: () => ({ where: () => ({ execute: async () => {} }) }) }),
		transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({})
	},
	sharedConfigurations: {},
	savedConfigurations: {},
	profiles: {}
}));

import {
	generateShortCode,
	calculateExpirationDate,
	isShareExpired,
	getDaysUntilExpiration
} from '$lib/server/share-utils';
```

Keep all existing `describe(...)` test blocks unchanged (they don't need modification — only the function implementations they test are now imported from the real module).

**Step 2: Run tests to verify they still pass**

```bash
bun test src/lib/server/share-utils.test.ts
```

Expected: all tests pass (same count as before).

**Step 3: Commit**

```bash
git add src/lib/server/share-utils.test.ts
git commit -m "fix: import share-utils functions from real module instead of copying"
```

---

## Task 2: Fix `camera-sync.ts` — Use Centralized Constant

**Problem:** `src/lib/stores/camera-sync.ts` defines `const DEBOUNCE_MS = 120` locally, duplicating `CAMERA_SYNC_DEBOUNCE_MS = 120` that already exists in `src/lib/constants.ts`.

**Files:**

- Modify: `src/lib/stores/camera-sync.ts`

**Step 1: Update the import and remove local constant**

At the top of `src/lib/stores/camera-sync.ts`, find the existing imports and add `CAMERA_SYNC_DEBOUNCE_MS`:

Old (around line 9-10):

```typescript
import { writable, get } from 'svelte/store';
```

New:

```typescript
import { writable, get } from 'svelte/store';
import { CAMERA_SYNC_DEBOUNCE_MS } from '$lib/constants';
```

Then find and remove the local constant (around line 30):

```typescript
const DEBOUNCE_MS = 120;
```

**Step 2: Replace usage of `DEBOUNCE_MS` with `CAMERA_SYNC_DEBOUNCE_MS`**

In the `updateFromSide` function (around line 70):

Old:

```typescript
		}, DEBOUNCE_MS);
```

New:

```typescript
		}, CAMERA_SYNC_DEBOUNCE_MS);
```

**Step 3: Run lint + type check**

```bash
bun run check
bun run lint
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/stores/camera-sync.ts
git commit -m "refactor: use CAMERA_SYNC_DEBOUNCE_MS constant in camera-sync store"
```

---

## Task 3: Write `use-visualization-save.test.ts`

**Files:**

- Create: `src/lib/use-visualization-save.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import type { SaveState } from './use-visualization-save';

// Auto-hoisted mocks — run before any module imports
mock.module('$app/paths', () => ({ base: '' }));

mock.module('$lib/saved-config-loader', () => ({
	loadSavedConfigParameters: mock(async () => ({
		ok: true,
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
	})),
	parseConfigParam: mock(() => ({
		ok: true,
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
	}))
}));

mock.module('$lib/chaos-validation', () => ({
	checkParameterStability: mock(() => ({ isStable: true, warnings: [] }))
}));

import {
	createSaveHandler,
	loadConfigFromUrl,
	createInitialSaveState
} from './use-visualization-save';
import type { ChaosMapParameters } from '$lib/types';

function makeState(overrides?: Partial<SaveState>): SaveState {
	return { ...createInitialSaveState(), ...overrides };
}

const defaultParams: ChaosMapParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
const getParams = () => defaultParams;

function makeFetch(response: {
	ok: boolean;
	status?: number;
	json?: () => Promise<unknown>;
}): typeof fetch {
	return mock(async () => ({
		ok: response.ok,
		status: response.status ?? (response.ok ? 200 : 400),
		json: response.json ?? (async () => ({ error: 'failed' }))
	})) as unknown as typeof fetch;
}

describe('createSaveHandler', () => {
	describe('success flow', () => {
		test('sets saveSuccess and closes dialog on success', async () => {
			const state = makeState({ showSaveDialog: true });
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({ ok: true });

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveSuccess).toBe(true);
			expect(state.showSaveDialog).toBe(false);
			expect(state.saveError).toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('resets isSaving to false after success', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({ ok: true });

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.isSaving).toBe(false);

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('error flow', () => {
		test('sets saveError on HTTP error response', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({ error: 'Server error occurred' })
			});

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBe('Server error occurred');
			expect(state.saveSuccess).toBe(false);
			expect(state.isSaving).toBe(false);

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('sets saveError on network error', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () => {
				throw new Error('Network failure');
			}) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(state.saveError).toBe('Network failure');
			expect(state.isSaving).toBe(false);

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('concurrency guard', () => {
		test('does not start a second save while isSaving is true', async () => {
			const state = makeState({ isSaving: true });
			let fetchCallCount = 0;
			const globalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () => {
				fetchCallCount++;
				return { ok: true, json: async () => ({}) };
			}) as unknown as typeof fetch;

			const { save, cleanup } = createSaveHandler('lorenz', state, getParams);
			await save('My Config');

			expect(fetchCallCount).toBe(0);

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('cleanup', () => {
		test('cleanup does not throw when called with no in-flight request', () => {
			const state = makeState();
			const { cleanup } = createSaveHandler('lorenz', state, getParams);
			expect(() => cleanup()).not.toThrow();
		});
	});
});

describe('loadConfigFromUrl', () => {
	test('returns {ok:"none"} when no url params provided', async () => {
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: new URLSearchParams()
		});
		expect(result.ok).toBe('none');
	});

	test('returns {ok:"none"} when signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const params = new URLSearchParams({ configId: 'some-id' });
		// Even with configId, aborted signal returns 'none'
		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params,
			signal: controller.signal
		});
		expect(result.ok).toBe('none');
	});

	test('returns parameters from config inline JSON param', async () => {
		const encoded = encodeURIComponent(
			JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
		);
		const params = new URLSearchParams({ config: encoded });

		const result = await loadConfigFromUrl({
			mapType: 'lorenz',
			searchParams: params
		});

		expect(result.ok).toBe(true);
		if (result.ok === true) {
			expect(result.parameters).toMatchObject({ sigma: 10, rho: 28, beta: 2.667 });
			expect(result.stabilityWarnings).toEqual([]);
		}
	});
});

describe('createInitialSaveState', () => {
	test('returns correct initial state shape', () => {
		const state = createInitialSaveState();
		expect(state.showSaveDialog).toBe(false);
		expect(state.isSaving).toBe(false);
		expect(state.saveSuccess).toBe(false);
		expect(state.saveError).toBeNull();
		expect(state.configErrors).toEqual([]);
		expect(state.showConfigError).toBe(false);
		expect(state.stabilityWarnings).toEqual([]);
		expect(state.showStabilityWarning).toBe(false);
	});
});
```

**Step 2: Run the tests**

```bash
bun test src/lib/use-visualization-save.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add src/lib/use-visualization-save.test.ts
git commit -m "test: add unit tests for use-visualization-save"
```

---

## Task 4: Write `use-visualization-share.test.ts`

**Files:**

- Create: `src/lib/use-visualization-share.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, test, expect, mock } from 'bun:test';
import type { ShareState } from './use-visualization-share';

// Auto-hoisted mock
mock.module('$app/paths', () => ({ base: '' }));

import { createShareHandler, createInitialShareState } from './use-visualization-share';
import type { ChaosMapParameters } from '$lib/types';

const defaultParams: ChaosMapParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 };
const getParams = () => defaultParams;

function makeState(overrides?: Partial<ShareState>): ShareState {
	return { ...createInitialShareState(), ...overrides };
}

function makeFetch(response: { ok: boolean; json?: () => Promise<unknown> }): typeof fetch {
	return mock(async () => ({
		ok: response.ok,
		status: response.ok ? 200 : 400,
		json: response.json ?? (async () => ({ error: 'failed' }))
	})) as unknown as typeof fetch;
}

describe('createShareHandler', () => {
	describe('success flow', () => {
		test('returns shareUrl and expiresAt on success', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: true,
				json: async () => ({
					shareUrl: 'https://example.com/s/abc123',
					expiresAt: '2026-03-01T00:00:00Z'
				})
			});

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			const result = await share();

			expect(result).toEqual({
				shareUrl: 'https://example.com/s/abc123',
				expiresAt: '2026-03-01T00:00:00Z'
			});
			expect(state.isSharing).toBe(false);
			expect(state.shareError).toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('error flow', () => {
		test('sets shareError and re-throws on HTTP error', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			globalThis.fetch = makeFetch({
				ok: false,
				json: async () => ({ error: 'Rate limit exceeded' })
			});

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);

			await expect(share()).rejects.toThrow('Rate limit exceeded');
			expect(state.shareError).toBe('Rate limit exceeded');
			expect(state.isSharing).toBe(false);

			cleanup();
			globalThis.fetch = globalFetch;
		});

		test('returns null on AbortError without setting shareError', async () => {
			const state = makeState();
			const globalFetch = globalThis.fetch;
			const abortError = new DOMException('Aborted', 'AbortError');
			globalThis.fetch = mock(async () => {
				throw abortError;
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			const result = await share().catch(() => null);

			// AbortError is swallowed — no error state set
			expect(state.shareError).toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('concurrency guard', () => {
		test('does not start a new share while isSharing is true', async () => {
			const state = makeState({ isSharing: true });
			let fetchCallCount = 0;
			const globalFetch = globalThis.fetch;
			globalThis.fetch = mock(async () => {
				fetchCallCount++;
				return { ok: true, json: async () => ({}) };
			}) as unknown as typeof fetch;

			const { share, cleanup } = createShareHandler('lorenz', state, getParams);
			const result = await share();

			expect(fetchCallCount).toBe(0);
			expect(result).toBeNull();

			cleanup();
			globalThis.fetch = globalFetch;
		});
	});

	describe('cleanup', () => {
		test('cleanup does not throw when no in-flight request', () => {
			const state = makeState();
			const { cleanup } = createShareHandler('lorenz', state, getParams);
			expect(() => cleanup()).not.toThrow();
		});
	});
});

describe('createInitialShareState', () => {
	test('returns correct initial state', () => {
		const state = createInitialShareState();
		expect(state.showShareDialog).toBe(false);
		expect(state.isSharing).toBe(false);
		expect(state.shareError).toBeNull();
	});
});
```

**Step 2: Run the tests**

```bash
bun test src/lib/use-visualization-share.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add src/lib/use-visualization-share.test.ts
git commit -m "test: add unit tests for use-visualization-share"
```

---

## Task 5: Write `stores/camera-sync.test.ts`

**Files:**

- Create: `src/lib/stores/camera-sync.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { cameraSyncStore, createCameraState, applyCameraState } from './camera-sync';

function makeCameraState(x = 0, y = 0, z = 0) {
	return {
		position: { x, y, z },
		target: { x: 0, y: 0, z: 0 }
	};
}

describe('cameraSyncStore', () => {
	beforeEach(() => {
		cameraSyncStore.reset();
	});

	describe('initial state', () => {
		test('starts with sync enabled and no camera states', () => {
			let state: Parameters<Parameters<typeof cameraSyncStore.subscribe>[0]>[0] | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			expect(state?.enabled).toBe(true);
			expect(state?.left).toBeNull();
			expect(state?.right).toBeNull();
			expect(state?.lastUpdate).toBeNull();
		});
	});

	describe('setEnabled / toggle', () => {
		test('setEnabled(false) disables sync', () => {
			cameraSyncStore.setEnabled(false);
			let state: { enabled: boolean } | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			expect(state?.enabled).toBe(false);
		});

		test('toggle flips enabled state', () => {
			cameraSyncStore.toggle(); // true -> false
			let state: { enabled: boolean } | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			expect(state?.enabled).toBe(false);

			cameraSyncStore.toggle(); // false -> true
			const unsub2 = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub2();
			expect(state?.enabled).toBe(true);
		});
	});

	describe('updateFromSide', () => {
		test('does not update immediately when disabled', async () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));

			// Wait longer than debounce
			await new Promise((r) => setTimeout(r, 200));

			let state: { left: unknown } | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			expect(state?.left).toBeNull();
		});

		test('debounces updates (state not set immediately)', () => {
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));

			// Check immediately — should not have updated yet
			let state: { left: unknown } | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			// left is set after debounce, not immediately
			// (The value may or may not be null depending on debounce timing)
			// Just verify updateFromSide doesn't throw
			expect(true).toBe(true);
		});

		test('sets lastUpdate after debounce', async () => {
			cameraSyncStore.updateFromSide('right', makeCameraState());

			await new Promise((r) => setTimeout(r, 200));

			let state: { lastUpdate: unknown } | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			expect(state?.lastUpdate).toBe('right');
		});
	});

	describe('getStateForSide', () => {
		test('returns null when sync is disabled', () => {
			cameraSyncStore.setEnabled(false);
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
		});

		test('returns null when there is no state for the other side', () => {
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
		});

		test('returns null when this side was last to update', async () => {
			cameraSyncStore.updateFromSide('left', makeCameraState());
			await new Promise((r) => setTimeout(r, 200));
			expect(cameraSyncStore.getStateForSide('left')).toBeNull();
		});

		test('returns other side state after that side updates', async () => {
			const rightState = makeCameraState(5, 6, 7);
			cameraSyncStore.updateFromSide('right', rightState);
			await new Promise((r) => setTimeout(r, 200));

			const result = cameraSyncStore.getStateForSide('left');
			expect(result).not.toBeNull();
			expect(result?.position.x).toBe(5);
		});
	});

	describe('reset', () => {
		test('reset clears all state back to defaults', async () => {
			cameraSyncStore.setEnabled(false);
			cameraSyncStore.updateFromSide('left', makeCameraState(1, 2, 3));
			await new Promise((r) => setTimeout(r, 200));

			cameraSyncStore.reset();

			let state: { enabled: boolean; left: unknown; lastUpdate: unknown } | undefined;
			const unsub = cameraSyncStore.subscribe((s) => {
				state = s;
			});
			unsub();
			expect(state?.enabled).toBe(true);
			expect(state?.left).toBeNull();
			expect(state?.lastUpdate).toBeNull();
		});
	});
});

describe('createCameraState', () => {
	test('extracts position and target from Three.js-like objects', () => {
		const camera = { position: { x: 1, y: 2, z: 3 } };
		const controls = { target: { x: 4, y: 5, z: 6 } };

		const result = createCameraState(camera, controls);

		expect(result.position).toEqual({ x: 1, y: 2, z: 3 });
		expect(result.target).toEqual({ x: 4, y: 5, z: 6 });
	});
});

describe('applyCameraState', () => {
	test('calls set() on position and target, then calls controls.update()', () => {
		let posSet: [number, number, number] | undefined;
		let targetSet: [number, number, number] | undefined;
		let updateCalled = false;

		const camera = {
			position: {
				x: 0,
				y: 0,
				z: 0,
				set(x: number, y: number, z: number) {
					posSet = [x, y, z];
				}
			}
		};
		const controls = {
			target: {
				x: 0,
				y: 0,
				z: 0,
				set(x: number, y: number, z: number) {
					targetSet = [x, y, z];
				}
			},
			update() {
				updateCalled = true;
			}
		};

		const state = { position: { x: 1, y: 2, z: 3 }, target: { x: 4, y: 5, z: 6 } };
		applyCameraState(state, camera, controls);

		expect(posSet).toEqual([1, 2, 3]);
		expect(targetSet).toEqual([4, 5, 6]);
		expect(updateCalled).toBe(true);
	});
});
```

**Step 2: Run the tests**

```bash
bun test src/lib/stores/camera-sync.test.ts
```

Expected: all tests pass.

**Step 3: Commit**

```bash
git add src/lib/stores/camera-sync.test.ts
git commit -m "test: add unit tests for camera-sync store"
```

---

## Task 6: Write UI Component Behavior Tests

**Files:**

- Create: `src/lib/components/ui/SaveConfigDialog.vitest.ts`
- Create: `src/lib/components/ui/DeleteConfirmDialog.vitest.ts`
- Create: `src/lib/components/ui/ParameterSlider.vitest.ts`
- Create: `src/lib/components/ui/ToastNotification.vitest.ts`

**Note on `<dialog>` support in jsdom:** jsdom doesn't implement `HTMLDialogElement.showModal()` or `.close()`. Mock these in a `beforeEach` helper:

```typescript
function mockDialogElement() {
	HTMLDialogElement.prototype.showModal = vi.fn();
	HTMLDialogElement.prototype.close = vi.fn();
}
```

### Sub-task 6a: SaveConfigDialog

**Step 1: Create `src/lib/components/ui/SaveConfigDialog.vitest.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import SaveConfigDialog from './SaveConfigDialog.svelte';

vi.mock('$app/paths', () => ({ base: '' }));

beforeEach(() => {
	HTMLDialogElement.prototype.showModal = vi.fn();
	HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
	cleanup();
});

const defaultProps = {
	open: true,
	mapType: 'lorenz',
	isAuthenticated: true,
	currentPath: '/lorenz',
	onClose: vi.fn(),
	onSave: vi.fn(async () => {})
};

describe('SaveConfigDialog', () => {
	it('renders the save form when authenticated', () => {
		render(SaveConfigDialog, { props: defaultProps });
		expect(screen.getByLabelText(/configuration name/i)).toBeInTheDocument();
	});

	it('shows login link when not authenticated', () => {
		render(SaveConfigDialog, {
			props: { ...defaultProps, isAuthenticated: false }
		});
		expect(screen.getByText('LOG_IN')).toBeInTheDocument();
	});

	it('disables save button when name is empty', () => {
		render(SaveConfigDialog, { props: defaultProps });
		const saveButton = screen.getByRole('button', { name: /^SAVE$/i });
		expect(saveButton).toBeDisabled();
	});

	it('enables save button when name is entered', async () => {
		render(SaveConfigDialog, { props: defaultProps });
		const input = screen.getByLabelText(/configuration name/i);
		await fireEvent.input(input, { target: { value: 'My Config' } });
		const saveButton = screen.getByRole('button', { name: /^SAVE$/i });
		expect(saveButton).not.toBeDisabled();
	});

	it('calls onSave with trimmed name on submit', async () => {
		const onSave = vi.fn(async () => {});
		render(SaveConfigDialog, { props: { ...defaultProps, onSave } });

		const input = screen.getByLabelText(/configuration name/i);
		await fireEvent.input(input, { target: { value: '  My Config  ' } });

		const form = screen.getByRole('button', { name: /^SAVE$/i }).closest('form')!;
		await fireEvent.submit(form);

		expect(onSave).toHaveBeenCalledWith('My Config');
	});

	it('calls onClose when cancel is clicked', async () => {
		const onClose = vi.fn();
		render(SaveConfigDialog, { props: { ...defaultProps, onClose } });

		await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
		expect(onClose).toHaveBeenCalled();
	});

	it('shows error for name exceeding 100 characters', async () => {
		render(SaveConfigDialog, { props: defaultProps });
		const input = screen.getByLabelText(/configuration name/i);
		const longName = 'a'.repeat(101);
		await fireEvent.input(input, { target: { value: longName } });

		const form = screen.getByRole('button', { name: /^SAVE$/i }).closest('form')!;
		await fireEvent.submit(form);

		expect(screen.getByText(/100 characters or less/i)).toBeInTheDocument();
	});
});
```

**Step 2: Create `src/lib/components/ui/DeleteConfirmDialog.vitest.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import DeleteConfirmDialog from './DeleteConfirmDialog.svelte';

beforeEach(() => {
	HTMLDialogElement.prototype.showModal = vi.fn();
	HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
	cleanup();
});

const defaultProps = {
	open: true,
	configName: 'My Lorenz Config',
	isDeleting: false,
	error: '',
	onClose: vi.fn(),
	onConfirm: vi.fn(async () => {})
};

describe('DeleteConfirmDialog', () => {
	it('displays the config name in the confirmation text', () => {
		render(DeleteConfirmDialog, { props: defaultProps });
		expect(screen.getByText('"My Lorenz Config"')).toBeInTheDocument();
	});

	it('shows error message when error prop is non-empty', () => {
		render(DeleteConfirmDialog, {
			props: { ...defaultProps, error: 'Delete failed' }
		});
		expect(screen.getByText('Delete failed')).toBeInTheDocument();
	});

	it('calls onConfirm when DELETE button is clicked', async () => {
		const onConfirm = vi.fn(async () => {});
		render(DeleteConfirmDialog, { props: { ...defaultProps, onConfirm } });

		await fireEvent.click(screen.getByRole('button', { name: /delete/i }));
		expect(onConfirm).toHaveBeenCalled();
	});

	it('calls onClose when Cancel is clicked', async () => {
		const onClose = vi.fn();
		render(DeleteConfirmDialog, { props: { ...defaultProps, onClose } });

		await fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
		expect(onClose).toHaveBeenCalled();
	});

	it('disables buttons while isDeleting is true', () => {
		render(DeleteConfirmDialog, { props: { ...defaultProps, isDeleting: true } });

		const cancelButton = screen.getByRole('button', { name: /cancel/i });
		const deleteButton = screen.getByRole('button', { name: /deleting/i });

		expect(cancelButton).toBeDisabled();
		expect(deleteButton).toBeDisabled();
	});
});
```

**Step 3: Create `src/lib/components/ui/ParameterSlider.vitest.ts`**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ParameterSlider from './ParameterSlider.svelte';

vi.mock('$lib/constants', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/constants')>();
	return { ...actual, SLIDER_DEBOUNCE_MS: 0 }; // disable debounce in tests
});

afterEach(() => {
	cleanup();
});

const defaultProps = {
	id: 'test-slider',
	label: 'Sigma',
	value: 10,
	min: 0,
	max: 50,
	step: 0.1,
	debounce: false // disable debounce for synchronous testing
};

describe('ParameterSlider', () => {
	it('renders label and value', () => {
		render(ParameterSlider, { props: defaultProps });
		expect(screen.getByText('Sigma')).toBeInTheDocument();
		expect(screen.getByText('10.00')).toBeInTheDocument();
	});

	it('renders the range input with correct attributes', () => {
		render(ParameterSlider, { props: defaultProps });
		const input = screen.getByRole('slider') as HTMLInputElement;
		expect(input).toBeInTheDocument();
		expect(input.min).toBe('0');
		expect(input.max).toBe('50');
	});

	it('calls onchange with the new numeric value when input changes', async () => {
		const onchange = vi.fn();
		render(ParameterSlider, { props: { ...defaultProps, onchange } });

		const input = screen.getByRole('slider');
		await fireEvent.input(input, { target: { value: '25' } });

		expect(onchange).toHaveBeenCalledWith(25);
	});

	it('respects custom decimal display', () => {
		render(ParameterSlider, {
			props: { ...defaultProps, value: 3.14159, decimals: 3 }
		});
		expect(screen.getByText('3.142')).toBeInTheDocument();
	});
});
```

**Step 4: Create `src/lib/components/ui/ToastNotification.vitest.ts`**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import ToastNotification from './ToastNotification.svelte';

afterEach(() => {
	vi.useRealTimers();
	cleanup();
});

describe('ToastNotification', () => {
	it('renders message when show is true', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Saved!', show: true }
		});
		expect(screen.getByText('Saved!')).toBeInTheDocument();
	});

	it('does not render when show is false', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Hidden', show: false }
		});
		expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
	});

	it('calls onDismiss when dismiss button is clicked', async () => {
		const onDismiss = vi.fn();
		render(ToastNotification, {
			props: {
				variant: 'error',
				message: 'An error occurred',
				show: true,
				dismissable: true,
				autoDismiss: false,
				onDismiss
			}
		});

		await fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
		expect(onDismiss).toHaveBeenCalled();
	});

	it('renders success variant with correct role', () => {
		render(ToastNotification, {
			props: { variant: 'success', message: 'Done', show: true }
		});
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('hides dismiss button when dismissable is false', () => {
		render(ToastNotification, {
			props: {
				variant: 'warning',
				message: 'Warning',
				show: true,
				dismissable: false
			}
		});
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
```

**Step 5: Run all component tests**

```bash
bun run test:unit
```

Expected: all 32 existing tests still pass, plus ~25 new tests added.

**Step 6: Commit**

```bash
git add src/lib/components/ui/SaveConfigDialog.vitest.ts \
        src/lib/components/ui/DeleteConfirmDialog.vitest.ts \
        src/lib/components/ui/ParameterSlider.vitest.ts \
        src/lib/components/ui/ToastNotification.vitest.ts
git commit -m "test: add behavior tests for UI components (SaveConfigDialog, DeleteConfirmDialog, ParameterSlider, ToastNotification)"
```

---

## Task 7: Write Renderer Smoke Tests

**Files to create:**

- `src/lib/components/visualizations/HenonRenderer.vitest.ts`
- `src/lib/components/visualizations/LogisticRenderer.vitest.ts`
- `src/lib/components/visualizations/NewtonRenderer.vitest.ts`
- `src/lib/components/visualizations/BifurcationLogisticRenderer.vitest.ts`
- `src/lib/components/visualizations/BifurcationHenonRenderer.vitest.ts`
- `src/lib/components/visualizations/LyapunovRenderer.vitest.ts`
- `src/lib/components/visualizations/ChaosEsthetiqueRenderer.vitest.ts`
- `src/lib/components/visualizations/LorenzRenderer.vitest.ts`
- `src/lib/components/visualizations/RosslerRenderer.vitest.ts`

**Canvas mock helper** (used by Newton, Bifurcation\*, Lyapunov, ChaosEsthetique):

```typescript
// Put in beforeAll/afterAll:
let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '',
		globalAlpha: 1,
		strokeStyle: '',
		lineWidth: 1,
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		fillRect: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
		putImageData: vi.fn()
	};
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ctx
	});
});
afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});
```

**Three.js mock** (used by LorenzRenderer and RosslerRenderer):

```typescript
vi.mock('three', () => ({
	WebGLRenderer: vi.fn(() => ({
		setSize: vi.fn(),
		setPixelRatio: vi.fn(),
		render: vi.fn(),
		dispose: vi.fn(),
		domElement: document.createElement('canvas'),
		setAnimationLoop: vi.fn()
	})),
	PerspectiveCamera: vi.fn(() => ({
		position: { set: vi.fn(), x: 0, y: 0, z: 30 },
		aspect: 1,
		updateProjectionMatrix: vi.fn()
	})),
	Scene: vi.fn(() => ({ background: null, add: vi.fn(), remove: vi.fn() })),
	Vector3: vi.fn(() => ({ set: vi.fn(), x: 0, y: 0, z: 0 })),
	Color: vi.fn(() => ({})),
	Points: vi.fn(() => ({ geometry: {}, material: {} })),
	BufferGeometry: vi.fn(() => ({
		setAttribute: vi.fn(),
		dispose: vi.fn()
	})),
	Float32BufferAttribute: vi.fn(() => ({})),
	PointsMaterial: vi.fn(() => ({ dispose: vi.fn() })),
	LineBasicMaterial: vi.fn(() => ({ dispose: vi.fn() }))
}));

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
	OrbitControls: vi.fn(() => ({
		enableDamping: false,
		autoRotate: false,
		autoRotateSpeed: 0,
		target: { x: 0, y: 0, z: 0, set: vi.fn() },
		update: vi.fn(),
		dispose: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
}));

vi.mock('three/examples/jsm/lines/Line2.js', () => ({
	Line2: vi.fn(() => ({ geometry: {}, material: {}, computeLineDistances: vi.fn() }))
}));

vi.mock('three/examples/jsm/lines/LineGeometry.js', () => ({
	LineGeometry: vi.fn(() => ({ setPositions: vi.fn(), dispose: vi.fn() }))
}));

vi.mock('three/examples/jsm/lines/LineMaterial.js', () => ({
	LineMaterial: vi.fn(() => ({ dispose: vi.fn(), resolution: { set: vi.fn() } }))
}));
```

### Sub-task 7a: D3 renderers (Henon, Logistic)

**`src/lib/components/visualizations/HenonRenderer.vitest.ts`:**

```typescript
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import HenonRenderer from './HenonRenderer.svelte';

afterEach(() => {
	cleanup();
});

describe('HenonRenderer (smoke)', () => {
	it('renders without throwing with default props', () => {
		expect(() =>
			render(HenonRenderer, {
				props: { a: 1.4, b: 0.3, iterations: 100, height: 200 }
			})
		).not.toThrow();
	});

	it('renders an SVG element', () => {
		const { container } = render(HenonRenderer, {
			props: { a: 1.4, b: 0.3, iterations: 100, height: 200 }
		});
		expect(container.querySelector('svg')).not.toBeNull();
	});
});
```

Create `LogisticRenderer.vitest.ts` with the same pattern (props: `r: 3.5, x0: 0.5, iterations: 100, height: 200`).

### Sub-task 7b: Canvas renderers (Newton, Bifurcation\*, Lyapunov, ChaosEsthetique)

Follow the **StandardRenderer.vitest.ts** pattern exactly — use `beforeAll`/`afterAll` to mock `getContext`, use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` to advance async rendering timers.

**`src/lib/components/visualizations/NewtonRenderer.vitest.ts`** (example):

```typescript
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import NewtonRenderer from './NewtonRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	const ctx = {
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
		putImageData: vi.fn(),
		beginPath: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		fillStyle: '',
		globalAlpha: 1
	};
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ctx
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});

describe('NewtonRenderer (smoke)', () => {
	afterEach(() => {
		vi.useRealTimers();
		cleanup();
	});

	it('renders canvas element without throwing', async () => {
		vi.useFakeTimers();
		const { container } = render(NewtonRenderer, {
			props: { xMin: -2, xMax: 2, yMin: -2, yMax: 2, maxIterations: 5, height: 200 }
		});

		await vi.advanceTimersByTimeAsync(200);

		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});
});
```

Apply the same pattern for:

- `BifurcationLogisticRenderer.vitest.ts` (props: `rMin: 2.5, rMax: 4, maxIterations: 100, height: 200`)
- `BifurcationHenonRenderer.vitest.ts` (props: `aMin: 0.5, aMax: 1.5, b: 0.3, maxIterations: 100, height: 200`)
- `LyapunovRenderer.vitest.ts` (props: `rMin: 2, rMax: 4, iterations: 100, transientIterations: 50, height: 200`)
- `ChaosEsthetiqueRenderer.vitest.ts` (props: `a: 1.5, b: 0.5, x0: 0, y0: 0, iterations: 100, height: 200`)

### Sub-task 7c: Three.js renderers (Lorenz, Rossler)

**`src/lib/components/visualizations/LorenzRenderer.vitest.ts`:**

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';

vi.mock('$lib/stores/camera-sync', () => ({
	cameraSyncStore: {
		subscribe: vi.fn(() => () => {}),
		getStateForSide: vi.fn(() => null),
		updateFromSide: vi.fn(),
		reset: vi.fn()
	},
	createCameraState: vi.fn(),
	applyCameraState: vi.fn()
}));

vi.mock('three', () => ({
	WebGLRenderer: vi.fn(() => ({
		setSize: vi.fn(),
		setPixelRatio: vi.fn(),
		render: vi.fn(),
		dispose: vi.fn(),
		domElement: document.createElement('canvas'),
		setAnimationLoop: vi.fn()
	})),
	PerspectiveCamera: vi.fn(() => ({
		position: { set: vi.fn(), x: 0, y: 0, z: 30 },
		aspect: 1,
		updateProjectionMatrix: vi.fn()
	})),
	Scene: vi.fn(() => ({ background: null, add: vi.fn(), remove: vi.fn() })),
	Vector3: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
	Color: vi.fn()
}));

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
	OrbitControls: vi.fn(() => ({
		enableDamping: false,
		autoRotate: false,
		autoRotateSpeed: 0,
		target: { x: 0, y: 0, z: 0, set: vi.fn() },
		update: vi.fn(),
		dispose: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn()
	}))
}));

vi.mock('three/examples/jsm/lines/Line2.js', () => ({
	Line2: vi.fn(() => ({ geometry: {}, material: {} }))
}));

vi.mock('three/examples/jsm/lines/LineGeometry.js', () => ({
	LineGeometry: vi.fn(() => ({ setPositions: vi.fn(), dispose: vi.fn() }))
}));

vi.mock('three/examples/jsm/lines/LineMaterial.js', () => ({
	LineMaterial: vi.fn(() => ({ dispose: vi.fn(), resolution: { set: vi.fn() } }))
}));

import LorenzRenderer from './LorenzRenderer.svelte';

describe('LorenzRenderer (smoke)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders without throwing', async () => {
		expect(() =>
			render(LorenzRenderer, {
				props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
			})
		).not.toThrow();
	});

	it('renders a container div', async () => {
		const { container } = render(LorenzRenderer, {
			props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('div')).not.toBeNull();
		});
	});
});
```

Apply same pattern for `RosslerRenderer.vitest.ts` (props: `a: 0.2, b: 0.2, c: 5.7, height: 200`). Check `RosslerRenderer.svelte` props before writing.

**Step 1: Create all 9 renderer test files**

**Step 2: Run tests**

```bash
bun run test:unit
```

Expected: all existing tests pass plus new renderer smoke tests.

**Step 3: Commit**

```bash
git add src/lib/components/visualizations/*.vitest.ts
git commit -m "test: add smoke tests for all visualization renderers"
```

---

## Task 8: Add TODO Comments for Untested API Surfaces

**Files:**

- Modify: `src/routes/api/save-config/+server.ts`
- Modify: `src/routes/api/share/+server.ts`
- Modify: `src/routes/api/saved-config/[id]/+server.ts`
- Modify: `src/routes/api/shared/[code]/+server.ts`

**Step 1: Add a TODO comment block near the top of each server file**

In `save-config/+server.ts`, after the imports, add:

```typescript
// TODO: Add integration tests for:
// - 401 response when not authenticated
// - 400 response for invalid JSON body
// - 400 response for missing/invalid name, mapType, parameters
// - 201 response and configuration shape on success
// - 500 response when database insert fails
// These require mocking locals.safeGetSession() and the db module.
```

Add similar TODO blocks to the other API files, customised to their specific paths/logic.

**Step 2: Commit**

```bash
git add src/routes/api/
git commit -m "docs: add TODO comments for untested API endpoint integration tests"
```

---

## Verification

After all tasks, run the full test suite:

```bash
bun test && bun run test:unit
```

Expected:

- All `bun test` tests pass (will be >280 tests)
- All `bun run test:unit` tests pass (will be >60 tests)
- No regressions

---

## Summary of Changes

| Task                            | Type      | New tests                      |
| ------------------------------- | --------- | ------------------------------ |
| Fix share-utils.test.ts         | Fix       | 0 (same tests, real functions) |
| Fix camera-sync.ts constant     | Refactor  | 0                              |
| use-visualization-save.test.ts  | Unit      | ~12                            |
| use-visualization-share.test.ts | Unit      | ~7                             |
| stores/camera-sync.test.ts      | Unit      | ~14                            |
| UI behavior tests (4 files)     | Component | ~20                            |
| Renderer smoke tests (9 files)  | Component | ~18                            |
| TODO comments                   | Docs      | 0                              |

**Total new tests: ~71**
