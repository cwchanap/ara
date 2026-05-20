# Unit Test Coverage to 90% Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Increase combined unit test coverage (bun + vitest) to 90%+ across all source files.

**Architecture:** Two test runners cover different layers: Bun (`.test.ts`, 98% on TS files) handles pure logic; Vitest (`.vitest.ts`, ~70% on components) handles Svelte components and DOM-dependent code. The biggest gaps are in Vitest, where shared TS libraries show 0-48% (indirect coverage only) and Svelte renderer components show 37-78%. We'll create new `.vitest.ts` test files for shared libraries and enhance existing renderer tests.

**Tech Stack:** Vitest, @testing-library/svelte, jsdom, vi.mock/vi.fn

---

## Priority: Highest Impact Shared Libraries (0-48% vitest coverage)

These files are fully tested by Bun but show near-0% in vitest because no `.vitest.ts` test file exists. Creating dedicated vitest tests will dramatically improve the combined vitest coverage.

### Task 1: `snapshot.ts` vitest tests (0% → 90%+)

**Files:**

- Create: `src/lib/snapshot.vitest.ts`
- Reference: `src/lib/snapshot.ts`
- Reference: `src/lib/components/ui/SnapshotButton.vitest.ts` (existing mock pattern)

**Step 1: Write the test file**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureCanvas, captureContainer, downloadSnapshot, generateFilename } from './snapshot';

describe('generateFilename', () => {
	it('generates a filename with default extension', () => {
		const result = generateFilename('lorenz');
		expect(result).toMatch(/^lorenz_\d{8}_\d{6}\.png$/);
	});

	it('generates a filename with custom extension', () => {
		const result = generateFilename('henon', 'jpg');
		expect(result).toMatch(/^henon_\d{8}_\d{6}\.jpg$/);
	});
});

describe('captureCanvas', () => {
	it('returns error when canvas is null', async () => {
		const result = await captureCanvas(null as unknown as HTMLCanvasElement);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('No canvas');
	});

	it('captures canvas as PNG data URL', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 10;
		canvas.height = 10;
		const result = await captureCanvas(canvas);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.dataUrl).toMatch(/^data:image\/png;base64,/);
	});

	it('captures canvas as JPEG with quality', async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 10;
		canvas.height = 10;
		const result = await captureCanvas(canvas, { format: 'jpeg', quality: 0.8 });
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
	});

	it('handles toDataURL errors', async () => {
		const canvas = document.createElement('canvas');
		canvas.toDataURL = () => {
			throw new Error('tainted canvas');
		};
		const result = await captureCanvas(canvas);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('tainted canvas');
	});
});

describe('captureContainer', () => {
	it('returns error when container is null', async () => {
		const result = await captureContainer(null as unknown as HTMLElement);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('No container');
	});

	it('captures container with canvas child', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		canvas.width = 10;
		canvas.height = 10;
		container.appendChild(canvas);
		const result = await captureContainer(container);
		expect(result.ok).toBe(true);
	});

	it('captures container with background color', async () => {
		const container = document.createElement('div');
		const canvas = document.createElement('canvas');
		canvas.width = 10;
		canvas.height = 10;
		container.appendChild(canvas);
		const result = await captureContainer(container, { backgroundColor: '#000' });
		expect(result.ok).toBe(true);
	});

	it('returns error when no canvas or SVG children', async () => {
		const container = document.createElement('div');
		container.innerHTML = '<span>no visual</span>';
		const result = await captureContainer(container);
		expect(result.ok).toBe(false);
	});
});

describe('downloadSnapshot', () => {
	let linkClickListener: ((e: Event) => void) | null = null;

	beforeEach(() => {
		linkClickListener = null;
		document.addEventListener('click', (e) => {
			const target = e.target as HTMLAnchorElement;
			if (target.tagName === 'A') {
				e.preventDefault();
				linkClickListener?.(e);
			}
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('creates a link and triggers download', () => {
		const clickSpy = vi.fn();
		const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
			const el = document.createElement(tag);
			if (tag === 'a') {
				el.click = clickSpy;
			}
			return el;
		});
		const appendSpy = vi.spyOn(document.body, 'appendChild');
		const removeSpy = vi.spyOn(document.body, 'removeChild');

		downloadSnapshot('data:image/png;base64,abc', 'test.png');

		expect(appendSpy).toHaveBeenCalled();
		expect(clickSpy).toHaveBeenCalled();
		expect(removeSpy).toHaveBeenCalled();

		createSpy.mockRestore();
	});
});
```

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/snapshot.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/snapshot.vitest.ts
git commit -m "test: add vitest tests for snapshot.ts"
```

---

### Task 2: `auth-errors.ts` vitest tests (48% → 95%+)

**Files:**

- Create: `src/lib/auth-errors.vitest.ts`
- Reference: `src/lib/auth-errors.ts`
- Reference: `src/lib/auth-errors.test.ts` (existing bun tests)

**Step 1: Write the test file**

```typescript
import { describe, expect, it } from 'vitest';
import { getErrorMessage, validateEmail, validatePassword, validateUsername } from './auth-errors';

describe('getErrorMessage', () => {
	it('returns default message for null error', () => {
		expect(getErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
	});

	it('returns default message for undefined error', () => {
		expect(getErrorMessage(undefined as unknown as Error)).toBe(
			'An unexpected error occurred. Please try again.'
		);
	});

	it('maps error code to message', () => {
		const error = { code: 'user_already_registered' } as Error & { code?: string };
		const result = getErrorMessage(error);
		expect(result).toBe('An account with this email already exists.');
	});

	it('maps invalid_credentials code', () => {
		const error = { code: 'invalid_credentials' } as Error & { code?: string };
		expect(getErrorMessage(error)).toBe('Invalid email or password.');
	});

	it('maps email_not_confirmed code', () => {
		const error = { code: 'email_not_confirmed' } as Error & { code?: string };
		expect(getErrorMessage(error)).toBe('Please confirm your email before signing in.');
	});

	it('falls back to message pattern matching - user already registered', () => {
		const error = new Error('User already registered with this email');
		const result = getErrorMessage(error);
		expect(result).toBe('An account with this email already exists.');
	});

	it('falls back to message pattern matching - invalid login credentials', () => {
		const error = new Error('Invalid login credentials');
		const result = getErrorMessage(error);
		expect(result).toBe('Invalid email or password.');
	});

	it('falls back to message pattern matching - weak password', () => {
		const error = new Error('Password is too weak');
		const result = getErrorMessage(error);
		expect(result).toBe('Password must be at least 6 characters.');
	});

	it('falls back to message pattern matching - invalid email', () => {
		const error = new Error('Email is invalid');
		const result = getErrorMessage(error);
		expect(result).toBe('Please enter a valid email address.');
	});

	it('returns default for unrecognized error', () => {
		const error = new Error('some unknown error');
		expect(getErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
	});

	it('handles string input with known code', () => {
		const result = getErrorMessage('user_already_registered' as unknown as Error);
		expect(result).toBe('An account with this email already exists.');
	});

	it('handles string input with unknown code', () => {
		const result = getErrorMessage('unknown_error' as unknown as Error);
		expect(result).toBe('An unexpected error occurred. Please try again.');
	});
});

describe('validateUsername', () => {
	it('returns error for empty username', () => {
		expect(validateUsername('')).toBe('Username is required.');
	});

	it('returns error for too short username', () => {
		expect(validateUsername('ab')).toBe('Username must be at least 3 characters.');
	});

	it('returns error for too long username', () => {
		expect(validateUsername('a'.repeat(31))).toBe('Username must be at most 30 characters.');
	});

	it('returns error for invalid characters', () => {
		expect(validateUsername('user@name')).toBe(
			'Username can only contain letters, numbers, and underscores.'
		);
	});

	it('returns null for valid username', () => {
		expect(validateUsername('valid_user')).toBeNull();
	});
});

describe('validatePassword', () => {
	it('returns error for empty password', () => {
		expect(validatePassword('')).toBe('Password is required.');
	});

	it('returns error for too short password', () => {
		expect(validatePassword('12345')).toBe('Password must be at least 6 characters.');
	});

	it('returns null for valid password', () => {
		expect(validatePassword('validpass')).toBeNull();
	});
});

describe('validateEmail', () => {
	it('returns error for empty email', () => {
		expect(validateEmail('')).toBe('Email is required.');
	});

	it('returns error for invalid email format', () => {
		expect(validateEmail('not-an-email')).toBe('Please enter a valid email address.');
	});

	it('returns null for valid email', () => {
		expect(validateEmail('user@example.com')).toBeNull();
	});
});
```

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/auth-errors.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/auth-errors.vitest.ts
git commit -m "test: add vitest tests for auth-errors.ts"
```

---

### Task 3: `use-debounced-effect.ts` vitest tests (45% → 95%+)

**Files:**

- Create: `src/lib/use-debounced-effect.vitest.ts`
- Reference: `src/lib/use-debounced-effect.ts`

**Step 1: Write the test file**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedEffect } from './use-debounced-effect';

describe('useDebouncedEffect', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('calls fn after default delay of 300ms', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn);
		trigger();
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(300);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('calls fn after custom delay', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 100);
		trigger();
		vi.advanceTimersByTime(99);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('debounces multiple rapid triggers', () => {
		const fn = vi.fn();
		const { trigger } = useDebouncedEffect(fn, 100);
		trigger();
		trigger();
		trigger();
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('cleanup prevents fn from being called', () => {
		const fn = vi.fn();
		const { trigger, cleanup } = useDebouncedEffect(fn, 100);
		trigger();
		cleanup();
		vi.advanceTimersByTime(200);
		expect(fn).not.toHaveBeenCalled();
	});

	it('cleanup with no pending timer does not throw', () => {
		const fn = vi.fn();
		const { cleanup } = useDebouncedEffect(fn, 100);
		expect(() => cleanup()).not.toThrow();
	});
});
```

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/use-debounced-effect.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/use-debounced-effect.vitest.ts
git commit -m "test: add vitest tests for use-debounced-effect.ts"
```

---

### Task 4: `use-visualization-save.ts` vitest tests (11% → 90%+)

**Files:**

- Create: `src/lib/use-visualization-save.vitest.ts`
- Reference: `src/lib/use-visualization-save.ts`
- Reference: `src/lib/use-visualization-save.test.ts` (existing bun test for patterns)

**Step 1: Read the source file to understand exact function signatures**

Read `src/lib/use-visualization-save.ts` to verify exports, then write:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ base: '' }));

import {
	createInitialSaveState,
	createSaveHandler,
	loadConfigFromUrl
} from './use-visualization-save';

describe('createInitialSaveState', () => {
	it('returns correct initial state', () => {
		const state = createInitialSaveState();
		expect(state.isSaving).toBe(false);
		expect(state.saveSuccess).toBe(false);
		expect(state.saveError).toBeNull();
	});
});

describe('createSaveHandler', () => {
	let state: ReturnType<typeof createInitialSaveState>;

	beforeEach(() => {
		state = createInitialSaveState();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('saves configuration successfully', async () => {
		const mockResponse = { ok: true, json: async () => ({ id: '123' }) };
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
		const getParams = () => ({ sigma: 10, rho: 28, beta: 2.66 });
		const handler = createSaveHandler('lorenz', state, getParams);
		await handler.save();
		expect(state.isSaving).toBe(false);
		expect(state.saveSuccess).toBe(true);
		expect(state.saveError).toBeNull();
	});

	it('handles HTTP error response', async () => {
		const mockResponse = { ok: false, statusText: 'Unauthorized' };
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
		const handler = createSaveHandler('lorenz', state, () => ({}));
		await handler.save();
		expect(state.saveSuccess).toBe(false);
		expect(state.saveError).toBeTruthy();
	});

	it('handles network error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
		const handler = createSaveHandler('lorenz', state, () => ({}));
		await handler.save();
		expect(state.saveError).toBeTruthy();
	});

	it('handles abort error silently', async () => {
		const abortError = new DOMException('Aborted', 'AbortError');
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);
		const handler = createSaveHandler('lorenz', state, () => ({}));
		await handler.save();
		expect(state.saveError).toBeNull();
	});

	it('prevents concurrent saves', async () => {
		let resolveFirst: (v: unknown) => void;
		const firstPromise = new Promise((r) => (resolveFirst = r));
		vi.spyOn(globalThis, 'fetch')
			.mockImplementationOnce(() => firstPromise as Promise<Response>)
			.mockResolvedValue({ ok: true, json: async () => ({ id: '2' }) } as Response);
		const handler = createSaveHandler('lorenz', state, () => ({}));
		const first = handler.save();
		const second = handler.save();
		resolveFirst!({ ok: true, json: async () => ({ id: '1' }) });
		await Promise.all([first, second]);
		expect(state.saveSuccess).toBe(true);
	});

	it('cleanup aborts pending request', () => {
		const handler = createSaveHandler('lorenz', state, () => ({}));
		handler.cleanup();
		expect(state.isSaving).toBe(false);
	});
});

describe('loadConfigFromUrl', () => {
	it('returns none when no config params', async () => {
		const result = await loadConfigFromUrl({
			configId: null,
			configParam: null,
			mapType: 'lorenz'
		});
		expect(result.ok).toBe('none');
	});

	it('loads config from configParam', async () => {
		const result = await loadConfigFromUrl({
			configId: null,
			configParam: '{"sigma":10,"rho":28,"beta":2.66}',
			mapType: 'lorenz'
		});
		expect(result.ok).toBe('loaded');
		if (result.ok === 'loaded') {
			expect(result.parameters).toEqual({ sigma: 10, rho: 28, beta: 2.66 });
		}
	});

	it('handles invalid JSON in configParam', async () => {
		const result = await loadConfigFromUrl({
			configId: null,
			configParam: 'not-json',
			mapType: 'lorenz'
		});
		expect(result.ok).toBe('error');
		if (result.ok === 'error') expect(result.error).toBeTruthy();
	});

	it('loads config from configId via API', async () => {
		const mockResponse = {
			ok: true,
			json: async () => ({ parameters: { sigma: 10, rho: 28, beta: 2.66 } })
		};
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
		const result = await loadConfigFromUrl({
			configId: '123',
			configParam: null,
			mapType: 'lorenz'
		});
		expect(result.ok).toBe('loaded');
	});
});
```

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/use-visualization-save.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/use-visualization-save.vitest.ts
git commit -m "test: add vitest tests for use-visualization-save.ts"
```

---

### Task 5: `use-visualization-share.ts` vitest tests (21% → 90%+)

**Files:**

- Create: `src/lib/use-visualization-share.vitest.ts`
- Reference: `src/lib/use-visualization-share.ts`

**Step 1: Write the test file**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ base: '' }));

import { createInitialShareState, createShareHandler } from './use-visualization-share';

describe('createInitialShareState', () => {
	it('returns correct initial state', () => {
		const state = createInitialShareState();
		expect(state.isSharing).toBe(false);
		expect(state.shareUrl).toBeNull();
		expect(state.shareError).toBeNull();
	});
});

describe('createShareHandler', () => {
	let state: ReturnType<typeof createInitialShareState>;

	beforeEach(() => {
		state = createInitialShareState();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shares configuration successfully', async () => {
		const mockResponse = {
			ok: true,
			json: async () => ({ code: 'abc123', expiresAt: '2026-06-01' })
		};
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
		const handler = createShareHandler('lorenz', state, () => ({ sigma: 10 }));
		await handler.share();
		expect(state.isSharing).toBe(false);
		expect(state.shareUrl).toBeTruthy();
		expect(state.shareError).toBeNull();
	});

	it('handles HTTP error', async () => {
		const mockResponse = { ok: false, statusText: 'Server error' };
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);
		const handler = createShareHandler('lorenz', state, () => ({}));
		await handler.share();
		expect(state.shareError).toBeTruthy();
	});

	it('handles network error', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
		const handler = createShareHandler('lorenz', state, () => ({}));
		await handler.share();
		expect(state.shareError).toBeTruthy();
	});

	it('handles abort error silently', async () => {
		const abortError = new DOMException('Aborted', 'AbortError');
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(abortError);
		const handler = createShareHandler('lorenz', state, () => ({}));
		await handler.share();
		expect(state.shareError).toBeNull();
	});

	it('prevents concurrent shares', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ code: 'abc', expiresAt: '2026-06-01' })
		} as Response);
		const handler = createShareHandler('lorenz', state, () => ({}));
		state.isSharing = true;
		await handler.share();
		expect(state.shareUrl).toBeNull();
	});

	it('cleanup aborts pending request', () => {
		const handler = createShareHandler('lorenz', state, () => ({}));
		handler.cleanup();
		expect(state.isSharing).toBe(false);
	});
});
```

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/use-visualization-share.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/use-visualization-share.vitest.ts
git commit -m "test: add vitest tests for use-visualization-share.ts"
```

---

### Task 6: `saved-config-loader.ts` vitest tests (70% → 90%+)

**Files:**

- Create: `src/lib/saved-config-loader.vitest.ts`
- Reference: `src/lib/saved-config-loader.ts`
- Reference: `src/lib/saved-config-loader.test.ts` (existing bun tests)

**Step 1: Read source to verify exact API, then write tests covering:**

- `parseConfigParam`: invalid URI, oversized param, deeply nested JSON, invalid JSON, invalid parameter structure
- `loadSavedConfigParameters`: API success, network error → sessionStorage fallback, sessionStorage unavailable, no data found
- `loadSharedConfigParameters`: success, 410 expired, other HTTP error, null data, mapType mismatch, network error

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/saved-config-loader.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/saved-config-loader.vitest.ts
git commit -m "test: add vitest tests for saved-config-loader.ts"
```

---

### Task 7: `chaos-validation.ts` vitest tests (70% → 95%+)

**Files:**

- Create: `src/lib/chaos-validation.vitest.ts`
- Reference: `src/lib/chaos-validation.ts`

**Step 1: Write tests covering:**

- `validateParameters`: null params, non-object params, Standard map 'K' normalization, unknown map type, missing keys, extra keys, non-number values, NaN values
- `checkParameterStability`: invalid params delegation, unknown map type, Newton xMin >= xMax, Bifurcation-Logistic rMin >= rMax, Bifurcation-Henon aMin >= aMax, Lyapunov rMin >= rMax, Lyapunov transientIterations > iterations
- `getStableRanges`: valid type, unknown type
- `isValidMapType`: valid types, invalid type

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/chaos-validation.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/chaos-validation.vitest.ts
git commit -m "test: add vitest tests for chaos-validation.ts"
```

---

### Task 8: `use-config-loader.ts` vitest tests (2% → 85%+)

**Files:**

- Create: `src/lib/use-config-loader.vitest.ts`
- Reference: `src/lib/use-config-loader.ts`

**Note:** This module depends on Svelte's `page` store. It must be mocked using `vi.hoisted()` pattern from `visualization-pages.vitest.ts`. Tests should exercise the reactive subscription logic by directly calling the `page.subscribe` callback with mock page objects.

**Step 1: Write tests covering:**

- No URL params → state cleared
- `configParam` in URL → valid inline config parses; invalid JSON; validation failure
- `shareCode` in URL → successful load; API error; AbortError silent
- `configId` in URL → successful load; API error
- Deduplication (same configKey ignored)
- Cleanup (aborts pending fetch, sets isUnmounted)

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/use-config-loader.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/use-config-loader.vitest.ts
git commit -m "test: add vitest tests for use-config-loader.ts"
```

---

## Priority: Svelte Component Enhancements

### Task 9: Enhance `VisualizationErrorBoundary.svelte` tests (42% → 80%+)

**Files:**

- Modify: `src/lib/components/ui/VisualizationErrorBoundary.vitest.ts`
- Reference: `src/lib/components/ui/VisualizationErrorBoundary.svelte`

**Step 1: Add tests for error fallback UI and retry:**

- Child component throws during render → error UI shown with mapType and error message
- Click retry button → errorState clears and children re-mount
- Non-Error thrown → wrapped in Error

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/components/ui/VisualizationErrorBoundary.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/components/ui/VisualizationErrorBoundary.vitest.ts
git commit -m "test: enhance VisualizationErrorBoundary vitest coverage"
```

---

### Task 10: Enhance renderer component tests (various → 80%+)

**Files:**

- Modify: `src/lib/components/visualizations/NewtonRenderer.vitest.ts`
- Modify: `src/lib/components/visualizations/BifurcationLogisticRenderer.vitest.ts`
- Modify: `src/lib/components/visualizations/LoziRenderer.vitest.ts`
- Modify: `src/lib/components/visualizations/LogisticRenderer.vitest.ts`
- Modify: `src/lib/components/visualizations/LorenzRenderer.vitest.ts`
- Reference: Corresponding `.svelte` files

**Step 1: For each renderer, add tests for:**

- Canvas/SVG element creation verification
- `createImageData` / `putImageData` called (canvas renderers)
- Parameter changes trigger re-render
- Zero-size guard (canvas renderers)
- Error handling / fallback paths

**Step 2: Run the tests**

Run: `bun run test:unit -- src/lib/components/visualizations/`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/components/visualizations/*.vitest.ts
git commit -m "test: enhance renderer component vitest coverage"
```

---

### Task 11: Enhance `SnapshotButton.svelte` tests (83% → 95%+)

**Files:**

- Modify: `src/lib/components/ui/SnapshotButton.vitest.ts`
- Reference: `src/lib/components/ui/SnapshotButton.svelte`

**Step 1: Add tests for:**

- Type mismatch: `targetType='canvas'` but target is a `<div>` → error shown
- Type mismatch: `targetType='container'` but target is `<canvas>` → error shown
- `captureCanvas` throws unexpected exception → error feedback
- Rapid double-click while capturing → second click ignored

**Step 2: Run the test**

Run: `bun run test:unit -- src/lib/components/ui/SnapshotButton.vitest.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/components/ui/SnapshotButton.vitest.ts
git commit -m "test: enhance SnapshotButton vitest coverage"
```

---

## Task 12: Final verification

**Step 1: Run full bun test suite with coverage**

Run: `bun test --coverage`
Expected: 98%+ lines (no regression)

**Step 2: Run full vitest suite with coverage**

Run: `bun run test:unit -- --coverage`
Expected: 90%+ statements/lines on all targeted files

**Step 3: Run all checks**

Run: `bun run check && bun run lint`
Expected: No errors

---

## Summary

| Task      | File                         | Before | After (est.) | New Tests |
| --------- | ---------------------------- | ------ | ------------ | --------- |
| 1         | `snapshot.ts`                | 0%     | 90%+         | ~10       |
| 2         | `auth-errors.ts`             | 48%    | 95%+         | ~20       |
| 3         | `use-debounced-effect.ts`    | 45%    | 95%+         | ~5        |
| 4         | `use-visualization-save.ts`  | 11%    | 90%+         | ~12       |
| 5         | `use-visualization-share.ts` | 21%    | 90%+         | ~7        |
| 6         | `saved-config-loader.ts`     | 70%    | 90%+         | ~15       |
| 7         | `chaos-validation.ts`        | 70%    | 95%+         | ~20       |
| 8         | `use-config-loader.ts`       | 2%     | 85%+         | ~10       |
| 9         | `VisualizationErrorBoundary` | 42%    | 80%+         | ~3        |
| 10        | Renderer components          | 37-78% | 80%+         | ~15       |
| 11        | `SnapshotButton`             | 83%    | 95%+         | ~4        |
| **Total** |                              |        |              | **~121**  |
