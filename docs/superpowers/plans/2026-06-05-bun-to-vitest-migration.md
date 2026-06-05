# Bun → Vitest Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the `bun test` runner and consolidate all unit/component tests onto a single Vitest invocation with two environment projects (node + jsdom), merging the 10 overlapping test pairs.

**Architecture:** One `vitest.config.ts` defines two projects selected by filename — `*.test.ts` runs in `node`, `*.svelte.test.ts` runs in `jsdom`. The 49 `bun:test` files are converted to Vitest; node-target files keep their `.test.ts` name (content-only change), jsdom-target files are renamed to `.svelte.test.ts`. The 62 existing `.vitest.ts` files are renamed to the unified convention. Bun remains the package manager/runtime. Playwright E2E is untouched.

**Tech Stack:** Vitest 4.0.18, `@sveltejs/kit/vite` plugin (resolves `$env`/`$app`/`@sveltejs/kit` natively), `@vitest/coverage-v8`, jsdom, `@testing-library/svelte`.

---

## Important Context for the Engineer

You are migrating an existing test suite, not writing new features. "Tests" here means the project's own test files; "passing" means those files run green under Vitest. Most tasks are **mechanical conversions** driven by the **Conversion Recipes** below — read that section first; later tasks say "apply Recipe X to file Y."

**The suite is intentionally in a broken intermediate state during migration.** Un-migrated `bun:test` files will fail under the new config because they import `bun:test`. That is expected. Each task verifies only the files it migrated, using targeted `vitest run <path>` commands. The final task confirms the whole suite is green.

Work on a dedicated branch. Commit after every task.

### Environment placement rule (memorize this)

A file goes to the **jsdom** project (named `*.svelte.test.ts`) **only if it uses DOM/browser APIs** — component rendering via `@testing-library/svelte`, `document`/`window`, canvas `getContext`, `requestAnimationFrame`, `$app/*` runtime imports, or Svelte `$effect` reactivity that touches the DOM. Everything else (chaos math, validation, server load functions, API handlers, db schema, pure parsing) is **node** (named `*.test.ts`).

### Definitive file → environment classification

**jsdom (`*.svelte.test.ts`) — bun files to convert + rename:**

- `src/lib/snapshot.bun.test.ts`, `src/lib/snapshot.extra.test.ts` (canvas) — fold into merge (Task 18)
- `src/lib/use-visualization-save.test.ts`, `src/lib/use-visualization-save-catch.test.ts` (`$app`) — fold into merge (Task 14)
- `src/lib/use-visualization-share.test.ts` (`$app`) — fold into merge (Task 15)
- `src/lib/use-config-loader.test.ts`, `src/lib/use-config-loader-catch.test.ts` — fold into merge (Task 12)
- `src/lib/use-debounced-effect.test.ts` — fold into merge (Task 13)
- `src/lib/stores/camera-sync.test.ts` (Task 10)
- `src/lib/lorenz/presets.test.ts` (Task 10)

**node (`*.test.ts`) — bun files, keep name, convert content only:** all remaining bun `.test.ts` files (chaos math, validation, auth, server, API, db schema). See task batches 6–9 and merges 11, 16, 17, 19, 20.

> If a file you convert/merge fails under its assigned project because of a missing global (e.g. `document is not defined` in a node test, or a `node:`-only API failing under jsdom), apply the **fallback rule**: move it to the other project by renaming (`*.test.ts` ⇄ `*.svelte.test.ts`). Note this in the commit message.

---

## Conversion Recipes

These are the complete transformations. Apply verbatim.

### Recipe A — Plain conversion (no module mocking)

For files whose only `bun:test` usage is `describe/test/expect/beforeEach/afterEach/beforeAll/afterAll`.

**Change the import line.** Replace:

```ts
import { describe, expect, test } from 'bun:test';
```

with (keep only the symbols the file actually uses, matching the existing line's symbol set):

```ts
import { describe, expect, test } from 'vitest';
```

Apply the same substitution for every variant, e.g.:

```ts
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
// becomes
import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
```

Note: `mock` (bun) → `vi` (vitest). Everything else keeps its name. Bun's `test` exists in Vitest, so no need to switch to `it`.

**Replace mock-function calls.** Bun's standalone mock function `mock(fn)` → `vi.fn(fn)`:

```ts
const handler = mock(async () => 'ok');
// becomes
const handler = vi.fn(async () => 'ok');
```

Nothing else changes. The `sveltekit()` Vite plugin resolves `$env/*`, `$app/paths`, and `@sveltejs/kit`, so any imports of those Just Work — no stubs needed.

### Recipe B — Static module mock (factory has no outer-scope references)

For `mock.module('x', () => ({ ... }))` where the factory body does **not** reference any variable declared in the test file (only literals/pure functions inside).

Replace:

```ts
mock.module('$lib/saved-config-loader', () => ({
	parseConfigParam: ({ mapType, configParam }) => {
		/* pure body */
	}
}));
const { useConfigLoader } = await import('./use-config-loader');
```

with:

```ts
vi.mock('$lib/saved-config-loader', () => ({
	parseConfigParam: ({ mapType, configParam }) => {
		/* pure body, unchanged */
	}
}));
const { useConfigLoader } = await import('./use-config-loader');
```

`vi.mock` is hoisted to the top of the file by Vitest's transform, but because the factory is self-contained that is harmless. Keep the existing `await import(...)` after it. Also apply Recipe A's import-line change.

### Recipe C — Stateful module mock (factory references mutable test state)

For `mock.module(...)` factories that reference top-level `let`/`const` variables (e.g. `mockDbInsertShouldThrow`, `lastInsertedValues`, `operationLog`, or a `mock()`-created spy). Vitest hoists `vi.mock` above all top-level statements, so the factory **cannot** see those variables directly — you must move the shared state into `vi.hoisted()`.

**Before (bun):**

```ts
import { beforeEach, describe, expect, mock, test } from 'bun:test';

let mockDbInsertShouldThrow = false;
let lastInsertedValues: Record<string, unknown> | null = null;
let operationLog: string[] = [];

const ensureProfileForUser = mock(async () => {
	operationLog.push('provision');
	return {
		/*...*/
	};
});
const mockReturning = async () => {
	if (mockDbInsertShouldThrow) throw new Error('DB connection failed');
	return [{ id: 'new-config-id', name: lastInsertedValues?.name ?? 'Test Config' /*...*/ }];
};

mock.module('$lib/server/db', () => ({
	db: {
		insert: () => ({
			values: (vals) => {
				operationLog.push('insert');
				lastInsertedValues = vals;
				return { returning: mockReturning };
			}
		})
	},
	savedConfigurations: {
		/* ...field stubs... */
	}
}));
mock.module('$lib/server/profile-provisioning', () => ({ ensureProfileForUser }));

const { POST } = await import('./+server');

beforeEach(() => {
	mockDbInsertShouldThrow = false;
	lastInsertedValues = null;
	operationLog = [];
	ensureProfileForUser.mockClear();
});
```

**After (vitest):**

```ts
import { beforeEach, describe, expect, vi, test } from 'vitest';

// All state the mock factories need lives inside vi.hoisted so it is
// initialised before the hoisted vi.mock calls run.
const h = vi.hoisted(() => {
	const state = {
		mockDbInsertShouldThrow: false,
		lastInsertedValues: null as Record<string, unknown> | null,
		operationLog: [] as string[]
	};
	const ensureProfileForUser = vi.fn(async () => {
		state.operationLog.push('provision');
		return {
			/*...*/
		};
	});
	const mockReturning = async () => {
		if (state.mockDbInsertShouldThrow) throw new Error('DB connection failed');
		return [{ id: 'new-config-id', name: state.lastInsertedValues?.name ?? 'Test Config' /*...*/ }];
	};
	return { state, ensureProfileForUser, mockReturning };
});

vi.mock('$lib/server/db', () => ({
	db: {
		insert: () => ({
			values: (vals: Record<string, unknown>) => {
				h.state.operationLog.push('insert');
				h.state.lastInsertedValues = vals;
				return { returning: h.mockReturning };
			}
		})
	},
	savedConfigurations: {
		/* ...field stubs, unchanged... */
	}
}));
vi.mock('$lib/server/profile-provisioning', () => ({
	ensureProfileForUser: h.ensureProfileForUser
}));

const { POST } = await import('./+server');

beforeEach(() => {
	h.state.mockDbInsertShouldThrow = false;
	h.state.lastInsertedValues = null;
	h.state.operationLog = [];
	h.ensureProfileForUser.mockClear();
});
```

Mechanical rules for Recipe C:

1. Wrap every top-level mutable variable and every `mock()`/`mockReturning`-style helper the factories use into a single `const h = vi.hoisted(() => { ...; return {...}; })`.
2. Convert primitive `let x = ...` flags into properties of a `state` object (so tests mutate `h.state.x` instead of reassigning a hoisted binding).
3. In the test body and `beforeEach`, replace bare references with `h.state.*` / `h.*`.
4. `mock(fn)` → `vi.fn(fn)`; `.mockClear()`/`.mockReset()` work the same.
5. Keep the `await import('./+server')` (or equivalent) exactly where it was — after the `vi.mock` calls.
6. Delete any comment about "overrides any mock registered by <other-file>.test.ts" — Vitest isolates modules per file, so cross-file mock pollution no longer happens.

### Recipe D — Merge two/three files into one

For the 10 overlapping bases (each has a bun `.test.ts` + a `.vitest.ts`, some with extra `.extra`/`.catch`/`.bun` siblings). Produce ONE file at the target path.

1. Start from the **`.vitest.ts`** file's content (it is already Vitest syntax) as the base; rename it to the target name.
2. Convert each sibling bun file with the appropriate recipe (A/B/C) **in isolation first** to confirm it is valid Vitest.
3. Copy each `describe(...)` block from the converted bun siblings into the base file. If a `describe` with the same name exists in both, merge the inner `test(...)` blocks; **drop only tests that are byte-for-byte semantic duplicates** (same name + same assertions). When unsure, keep both — a duplicate test is harmless, a dropped one loses coverage.
4. Consolidate imports into one `import { ... } from 'vitest'` line and one import of the module under test.
5. If both files mocked the same module differently, reconcile to a single `vi.mock`/`vi.hoisted` that satisfies all tests (prefer the more complete factory).
6. Delete the now-empty sibling source files.
7. Verify with the count guard: the merged file's `test(`/`it(` count must be **≥ the larger** of its source files' counts, and every unique test _name_ from every source must appear (use the name-diff command in Task 21).

---

## Phase 0 — Baseline

### Task 0: Branch and capture baseline

**Files:** none (git + scratch file)

- [ ] **Step 1: Create the migration branch**

```bash
git checkout -b migrate-bun-to-vitest
```

- [ ] **Step 2: Capture the baseline test inventory**

Run and save the output to `/tmp/baseline-tests.txt`:

```bash
{
  echo "=== per-file case counts (bun + vitest) ===";
  for f in $(find src -name "*.test.ts" -o -name "*.vitest.ts" | sort); do
    printf "%-70s %s\n" "$f" "$(grep -cE "^\s*(test|it)\(" "$f")";
  done;
  echo "=== test names (sorted) ===";
  grep -rhoE "^\s*(test|it)\(\s*['\\\"\`][^'\\\"\`]+" src --include="*.test.ts" --include="*.vitest.ts" | sed -E "s/^\s*(test|it)\(\s*['\\\"\`]//" | sort > /tmp/baseline-names.txt;
  wc -l /tmp/baseline-names.txt;
} | tee /tmp/baseline-tests.txt
```

Expected: a file listing ~111 test files and a `/tmp/baseline-names.txt` with the sorted set of all test names (~1733 lines, including duplicates across bun/vitest pairs).

- [ ] **Step 3: Confirm both runners currently pass (sanity)**

```bash
bun test 2>&1 | tail -5
bun run test:unit 2>&1 | tail -5
```

Expected: both report all tests passing. (If pre-existing failures exist, record them; they are not your regressions.)

- [ ] **Step 4: Commit the branch point (no code change yet)**

No commit needed — proceed. The baseline lives in `/tmp`.

---

## Phase 1 — Vitest config with two projects

### Task 1: Add the node-project setup file

**Files:**

- Create: `vitest.setup.node.ts`

- [ ] **Step 1: Create the node setup file**

This ports the one useful behavior from the old `src/test-setup.ts` — defaulting `DATABASE_URL` so server modules don't crash at import.

```ts
// vitest.setup.node.ts
// Setup for the node project. Server modules read DATABASE_URL / NETLIFY_DATABASE_URL
// at import time; provide a dummy value so importing them in tests does not crash.
if (!process.env.DATABASE_URL && !process.env.NETLIFY_DATABASE_URL) {
	process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
}
```

- [ ] **Step 2: Commit**

```bash
git add vitest.setup.node.ts
git commit -m "test: add node-project vitest setup with DATABASE_URL default"
```

### Task 2: Rewrite vitest.config.ts into two projects

**Files:**

- Modify: `vitest.config.ts`

- [ ] **Step 1: Replace the whole file**

The jsdom project temporarily also includes `*.vitest.ts` so the existing 62 Vitest files keep running until they are renamed in Phase 6. The node project excludes the svelte/vitest patterns. Coverage ignore patterns are ported from `bunfig.toml`.

```ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: { $lib: resolve('./src/lib') },
		conditions: ['browser']
	},
	test: {
		globals: true,
		coverage: {
			include: ['src/**/*.{ts,svelte}'],
			exclude: [
				'src/**/*.test.ts',
				'src/**/*.svelte.test.ts',
				'src/**/*.vitest.ts',
				'src/test-setup.ts',
				'src/lib/constants.ts',
				'src/lib/workers/types.ts',
				'src/lib/index.ts',
				'**/*.d.ts'
			],
			extension: ['.ts', '.svelte']
		},
		projects: [
			{
				extends: true,
				test: {
					name: 'node',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.svelte.test.ts', 'src/**/*.vitest.ts'],
					setupFiles: ['./vitest.setup.node.ts'],
					alias: { $lib: resolve('./src/lib') }
				}
			},
			{
				extends: true,
				test: {
					name: 'jsdom',
					environment: 'jsdom',
					// TEMP: *.vitest.ts kept until Phase 6 renames them; remove in Task 25.
					include: ['src/**/*.svelte.test.ts', 'src/**/*.vitest.ts'],
					setupFiles: ['./vitest.setup.ts'],
					alias: { $lib: resolve('./src/lib') }
				}
			}
		]
	}
});
```

- [ ] **Step 2: Verify the jsdom project still runs the existing Vitest suite**

```bash
bun run vitest run --project jsdom 2>&1 | tail -8
```

Expected: the existing `*.vitest.ts` tests pass (same as before). The node project will currently fail on un-converted bun files — that is expected; do not run `--project node` whole yet.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: restructure vitest into node + jsdom projects"
```

---

## Phase 2 — Convert node bun-only files (no mocks): Recipe A

Each task: apply **Recipe A**, run the converted file under the node project, commit.

### Task 3: Convert pure chaos-math / type node tests (batch 1)

**Files (convert in place, names unchanged):**

- `src/lib/chua.test.ts`
- `src/lib/chua-validation.test.ts`
- `src/lib/lozi.test.ts`
- `src/lib/lozi.extra.test.ts`
- `src/lib/rossler.test.ts`
- `src/lib/rossler.extra.test.ts`
- `src/lib/lorenz/defaults.test.ts`
- `src/lib/lorenz/integrators.test.ts`
- `src/lib/lorenz/lyapunov.test.ts`

- [ ] **Step 1:** Apply Recipe A to each file above (change the `bun:test` import to `vitest`).

- [ ] **Step 2: Run the converted files**

```bash
bun run vitest run --project node src/lib/chua.test.ts src/lib/chua-validation.test.ts src/lib/lozi.test.ts src/lib/lozi.extra.test.ts src/lib/rossler.test.ts src/lib/rossler.extra.test.ts src/lib/lorenz/defaults.test.ts src/lib/lorenz/integrators.test.ts src/lib/lorenz/lyapunov.test.ts 2>&1 | tail -12
```

Expected: PASS, with the same number of tests as the baseline for these files.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chua.test.ts src/lib/chua-validation.test.ts src/lib/lozi.test.ts src/lib/lozi.extra.test.ts src/lib/rossler.test.ts src/lib/rossler.extra.test.ts src/lib/lorenz/defaults.test.ts src/lib/lorenz/integrators.test.ts src/lib/lorenz/lyapunov.test.ts
git commit -m "test: convert chaos-math node tests from bun to vitest"
```

### Task 4: Convert misc pure node tests (batch 2)

**Files:**

- `src/lib/utils.test.ts`
- `src/lib/types.test.ts`
- `src/lib/constants.test.ts`
- `src/lib/api-validation.test.ts`
- `src/lib/comparison-url-state.test.ts`
- `src/lib/comparison-url-state.extra.test.ts`
- `src/lib/auth/redirects.test.ts`
- `src/lib/auth/neon-contract.test.ts`
- `src/lib/workers/chaosMapsWorker.test.ts`
- `src/lib/server/db/schema.test.ts`

- [ ] **Step 1:** Apply Recipe A to each.

- [ ] **Step 2: Run**

```bash
bun run vitest run --project node src/lib/utils.test.ts src/lib/types.test.ts src/lib/constants.test.ts src/lib/api-validation.test.ts src/lib/comparison-url-state.test.ts src/lib/comparison-url-state.extra.test.ts src/lib/auth/redirects.test.ts src/lib/auth/neon-contract.test.ts src/lib/workers/chaosMapsWorker.test.ts src/lib/server/db/schema.test.ts 2>&1 | tail -12
```

Expected: PASS.

> If `schema.test.ts` fails on `drizzle-orm` named exports, it is the real package now (no stub). Adjust the assertion to the real export shape rather than reintroducing a stub.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.test.ts src/lib/types.test.ts src/lib/constants.test.ts src/lib/api-validation.test.ts src/lib/comparison-url-state.test.ts src/lib/comparison-url-state.extra.test.ts src/lib/auth/redirects.test.ts src/lib/auth/neon-contract.test.ts src/lib/workers/chaosMapsWorker.test.ts src/lib/server/db/schema.test.ts
git commit -m "test: convert misc pure node tests from bun to vitest"
```

---

## Phase 3 — Convert node bun files that mock modules: Recipes B/C

These are the highest-risk files. Do them one at a time; each is its own task.

### Task 5: Convert `src/lib/auth/neon.test.ts`

**Files:** Modify `src/lib/auth/neon.test.ts`

- [ ] **Step 1:** Inspect its `mock.module` usage. If the factory references no outer state, apply **Recipe B**; otherwise **Recipe C**.
- [ ] **Step 2: Run**

```bash
bun run vitest run --project node src/lib/auth/neon.test.ts 2>&1 | tail -10
```

Expected: PASS with the same test count as baseline.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/neon.test.ts
git commit -m "test: convert auth/neon test to vitest mocks"
```

### Task 6: Convert `src/lib/server/share-utils.test.ts`

**Files:** Modify `src/lib/server/share-utils.test.ts`

- [ ] **Step 1:** Apply Recipe B or C per its factory.
- [ ] **Step 2: Run**

```bash
bun run vitest run --project node src/lib/server/share-utils.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/share-utils.test.ts
git commit -m "test: convert server/share-utils test to vitest mocks"
```

### Task 7: Convert `src/hooks.server.test.ts`

**Files:** Modify `src/hooks.server.test.ts`

- [ ] **Step 1:** Apply Recipe C (it mocks `$env/*` and likely DB). Note: the real `$env/dynamic/private` is provided by the `sveltekit()` plugin and reads `process.env`; if the test set env vars via the bun stub, set them on `process.env` in `beforeEach` instead, or `vi.mock('$env/dynamic/private', () => ({ env: process.env }))`.
- [ ] **Step 2: Run**

```bash
bun run vitest run --project node src/hooks.server.test.ts 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks.server.test.ts
git commit -m "test: convert hooks.server test to vitest mocks"
```

### Task 8: Convert the route `+page.server` tests

**Files (one Recipe-C conversion each):**

- `src/routes/layout.server.test.ts`
- `src/routes/login/page.server.test.ts`
- `src/routes/signup/page.server.test.ts`
- `src/routes/profile/page.server.test.ts`
- `src/routes/saved-configs/page.server.test.ts`
- `src/routes/s/[code]/page.server.test.ts`

- [ ] **Step 1:** Apply Recipe C to each (move mock state into `vi.hoisted`, keep `await import(...)`). `signup` may have no mocks → Recipe A.
- [ ] **Step 2: Run**

```bash
bun run vitest run --project node "src/routes/layout.server.test.ts" "src/routes/login/page.server.test.ts" "src/routes/signup/page.server.test.ts" "src/routes/profile/page.server.test.ts" "src/routes/saved-configs/page.server.test.ts" "src/routes/s/[code]/page.server.test.ts" 2>&1 | tail -14
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/layout.server.test.ts" "src/routes/login/page.server.test.ts" "src/routes/signup/page.server.test.ts" "src/routes/profile/page.server.test.ts" "src/routes/saved-configs/page.server.test.ts" "src/routes/s/[code]/page.server.test.ts"
git commit -m "test: convert route page.server tests to vitest mocks"
```

### Task 9: Convert the API endpoint tests

**Files (Recipe C each):**

- `src/routes/api/save-config/server.test.ts`
- `src/routes/api/share/server.test.ts`
- `src/routes/api/saved-config/[id]/server.test.ts`
- `src/routes/api/shared/[code]/server.test.ts`

- [ ] **Step 1:** Apply Recipe C to each (these are the `db` + `profile-provisioning` mocks; the `save-config` file is the worked example in Recipe C).
- [ ] **Step 2: Run**

```bash
bun run vitest run --project node "src/routes/api/save-config/server.test.ts" "src/routes/api/share/server.test.ts" "src/routes/api/saved-config/[id]/server.test.ts" "src/routes/api/shared/[code]/server.test.ts" 2>&1 | tail -14
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/routes/api/save-config/server.test.ts" "src/routes/api/share/server.test.ts" "src/routes/api/saved-config/[id]/server.test.ts" "src/routes/api/shared/[code]/server.test.ts"
git commit -m "test: convert API endpoint tests to vitest mocks"
```

---

## Phase 4 — Convert jsdom bun-only files

### Task 10: Convert + rename `camera-sync` and `presets` to jsdom

**Files:**

- Modify+rename: `src/lib/stores/camera-sync.test.ts` → `src/lib/stores/camera-sync.svelte.test.ts`
- Modify+rename: `src/lib/lorenz/presets.test.ts` → `src/lib/lorenz/presets.svelte.test.ts`

- [ ] **Step 1:** Apply Recipe A (or B/C if they mock) to each, then rename with `git mv`:

```bash
git mv src/lib/stores/camera-sync.test.ts src/lib/stores/camera-sync.svelte.test.ts
git mv src/lib/lorenz/presets.test.ts src/lib/lorenz/presets.svelte.test.ts
```

- [ ] **Step 2: Run under jsdom**

```bash
bun run vitest run --project jsdom src/lib/stores/camera-sync.svelte.test.ts src/lib/lorenz/presets.svelte.test.ts 2>&1 | tail -10
```

Expected: PASS. (Fallback rule: if either passes fine in node and uses no DOM, you may keep it `.test.ts` instead — but the baseline grep flagged browser API usage, so jsdom is the safe choice.)

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/stores/ src/lib/lorenz/presets.svelte.test.ts
git commit -m "test: convert camera-sync and presets tests to vitest (jsdom)"
```

---

## Phase 5 — Merge the 10 overlapping pairs (Recipe D)

Each merge yields ONE file and deletes the siblings. After each, run the merged file and check the count guard.

### Task 11: Merge `auth-errors` (node)

**Files:**

- Base: `src/lib/auth-errors.vitest.ts` (64 cases) → rename to `src/lib/auth-errors.test.ts`
- Fold in: `src/lib/auth-errors.test.ts` (bun, 28 cases) — converted via Recipe A

- [ ] **Step 1:** Convert the bun `auth-errors.test.ts` with Recipe A into a scratch buffer. Open `auth-errors.vitest.ts`. Copy any `describe`/`test` blocks unique to the bun version into it. Then replace the bun file's content with the merged result and `git rm` the `.vitest.ts`:

```bash
# after editing src/lib/auth-errors.test.ts to contain the merged content:
git rm src/lib/auth-errors.vitest.ts
```

- [ ] **Step 2: Run + count guard**

```bash
bun run vitest run --project node src/lib/auth-errors.test.ts 2>&1 | tail -6
grep -cE "^\s*(test|it)\(" src/lib/auth-errors.test.ts   # must be >= 64
```

Expected: PASS; count ≥ 64.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-errors.test.ts
git commit -m "test: merge auth-errors bun+vitest into one node test"
```

### Task 12: Merge `use-config-loader` (jsdom)

**Files:**

- Base: `src/lib/use-config-loader.vitest.ts` → rename to `src/lib/use-config-loader.svelte.test.ts`
- Fold in: `src/lib/use-config-loader.test.ts` (Recipe B/C) + `src/lib/use-config-loader-catch.test.ts` (Recipe C)

- [ ] **Step 1:** Convert both bun siblings (they mock `$lib/saved-config-loader`; see Recipe B example). Reconcile the two `$lib/saved-config-loader` mocks into one `vi.mock`. Merge unique blocks into the base. Target file `src/lib/use-config-loader.svelte.test.ts`. Then:

```bash
git rm src/lib/use-config-loader.vitest.ts src/lib/use-config-loader.test.ts src/lib/use-config-loader-catch.test.ts
```

(Create the new file at the target path with merged content.)

- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project jsdom src/lib/use-config-loader.svelte.test.ts 2>&1 | tail -6
```

Expected: PASS; count ≥ max(source counts).

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/use-config-loader.svelte.test.ts
git commit -m "test: merge use-config-loader bun+vitest into one jsdom test"
```

### Task 13: Merge `use-debounced-effect` (jsdom)

**Files:**

- Base: `src/lib/use-debounced-effect.vitest.ts` → `src/lib/use-debounced-effect.svelte.test.ts`
- Fold in: `src/lib/use-debounced-effect.test.ts` (Recipe B/C)

- [ ] **Step 1:** Convert the bun sibling, merge unique blocks into the base at the target path, then `git rm` both old files.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project jsdom src/lib/use-debounced-effect.svelte.test.ts 2>&1 | tail -6
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/use-debounced-effect.svelte.test.ts
git commit -m "test: merge use-debounced-effect bun+vitest into one jsdom test"
```

### Task 14: Merge `use-visualization-save` (jsdom)

**Files:**

- Base: `src/lib/use-visualization-save.vitest.ts` → `src/lib/use-visualization-save.svelte.test.ts`
- Fold in: `src/lib/use-visualization-save.test.ts` + `src/lib/use-visualization-save-catch.test.ts` (Recipe C; they mock `$app/*` + db)

- [ ] **Step 1:** Convert both bun siblings, merge into target, `git rm` the three old files.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project jsdom src/lib/use-visualization-save.svelte.test.ts 2>&1 | tail -6
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/use-visualization-save.svelte.test.ts
git commit -m "test: merge use-visualization-save bun+vitest into one jsdom test"
```

### Task 15: Merge `use-visualization-share` (jsdom)

**Files:**

- Base: `src/lib/use-visualization-share.vitest.ts` → `src/lib/use-visualization-share.svelte.test.ts`
- Fold in: `src/lib/use-visualization-share.test.ts` (Recipe C)

- [ ] **Step 1:** Convert, merge, `git rm` old files.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project jsdom src/lib/use-visualization-share.svelte.test.ts 2>&1 | tail -6
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/use-visualization-share.svelte.test.ts
git commit -m "test: merge use-visualization-share bun+vitest into one jsdom test"
```

### Task 16: Merge `saved-config-loader` (node)

**Files:**

- Base: `src/lib/saved-config-loader.vitest.ts` → `src/lib/saved-config-loader.test.ts`
- Fold in: bun `src/lib/saved-config-loader.test.ts` (Recipe B/C)

- [ ] **Step 1:** Convert bun sibling, merge into the `.test.ts` path (overwrite), `git rm` the `.vitest.ts`.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project node src/lib/saved-config-loader.test.ts 2>&1 | tail -6
```

Expected: PASS. (Fallback: if it needs DOM, rename to `.svelte.test.ts`.)

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/saved-config-loader.test.ts
git commit -m "test: merge saved-config-loader bun+vitest into one node test"
```

### Task 17: Merge `type-guards` (node)

**Files:**

- Base: bun `src/lib/type-guards.test.ts` (16 cases) is the larger; convert it with Recipe A and keep the `.test.ts` name.
- Fold in: `src/lib/type-guards.vitest.ts` (3 cases) — copy any unique blocks.

- [ ] **Step 1:** Convert bun file (Recipe A), copy unique tests from `.vitest.ts`, then `git rm src/lib/type-guards.vitest.ts`.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project node src/lib/type-guards.test.ts 2>&1 | tail -6
grep -cE "^\s*(test|it)\(" src/lib/type-guards.test.ts   # must be >= 16
```

Expected: PASS; count ≥ 16.

- [ ] **Step 3: Commit**

```bash
git add src/lib/type-guards.test.ts
git commit -m "test: merge type-guards bun+vitest into one node test"
```

### Task 18: Merge `snapshot` (jsdom)

**Files:**

- Base: `src/lib/snapshot.vitest.ts` → `src/lib/snapshot.svelte.test.ts`
- Fold in: `src/lib/snapshot.bun.test.ts` + `src/lib/snapshot.extra.test.ts` (Recipe B/C; canvas)

- [ ] **Step 1:** Convert both bun siblings, merge into target, `git rm` all three old files.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project jsdom src/lib/snapshot.svelte.test.ts 2>&1 | tail -6
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/snapshot.svelte.test.ts
git commit -m "test: merge snapshot bun+extra+vitest into one jsdom test"
```

### Task 19: Merge `chaos-validation` (node)

**Files:**

- Base: bun `src/lib/chaos-validation.test.ts` (168 cases) is the larger; convert with Recipe A, keep `.test.ts`.
- Fold in: `src/lib/chaos-validation.extra.test.ts` (Recipe A) + `src/lib/chaos-validation.vitest.ts` (59 cases) — copy unique blocks.

- [ ] **Step 1:** Convert bun base + extra (Recipe A), copy unique tests from `.vitest.ts`, then `git rm src/lib/chaos-validation.extra.test.ts src/lib/chaos-validation.vitest.ts`.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project node src/lib/chaos-validation.test.ts 2>&1 | tail -6
grep -cE "^\s*(test|it)\(" src/lib/chaos-validation.test.ts   # must be >= 168
```

Expected: PASS; count ≥ 168.

- [ ] **Step 3: Commit**

```bash
git add src/lib/chaos-validation.test.ts
git commit -m "test: merge chaos-validation bun+extra+vitest into one node test"
```

### Task 20: Merge `lorenz/colors` (node) and `server/profile-provisioning` (node)

**Files:**

- `src/lib/lorenz/colors.vitest.ts` + bun `src/lib/lorenz/colors.test.ts` → one `src/lib/lorenz/colors.test.ts`
- `src/lib/server/profile-provisioning.vitest.ts` + bun `src/lib/server/profile-provisioning.test.ts` → one `src/lib/server/profile-provisioning.test.ts`

- [ ] **Step 1:** For each base: convert the bun file (Recipe A for colors; Recipe C for profile-provisioning — it mocks db), copy unique blocks from the `.vitest.ts`, then `git rm` the `.vitest.ts`.
- [ ] **Step 2: Run + guard**

```bash
bun run vitest run --project node src/lib/lorenz/colors.test.ts src/lib/server/profile-provisioning.test.ts 2>&1 | tail -8
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/lorenz/colors.test.ts src/lib/server/profile-provisioning.test.ts
git commit -m "test: merge lorenz/colors and profile-provisioning into node tests"
```

---

## Phase 6 — Rename remaining `.vitest.ts` files

At this point every `.vitest.ts` that had a bun pair is already merged/removed. The remaining `.vitest.ts` files are all jsdom (components + route render tests) with no bun pair.

### Task 21: Rename all remaining `.vitest.ts` → `.svelte.test.ts`

**Files:** all remaining `src/**/*.vitest.ts` (≈52 files: every `src/lib/components/**/*.vitest.ts` and the `src/routes/*.vitest.ts` render/interaction tests).

- [ ] **Step 1: Bulk rename with git**

```bash
for f in $(find src -name "*.vitest.ts"); do
  git mv "$f" "${f%.vitest.ts}.svelte.test.ts";
done
```

- [ ] **Step 2: Verify none remain**

```bash
find src -name "*.vitest.ts"   # expect: no output
```

- [ ] **Step 3: Run the whole jsdom project**

```bash
bun run vitest run --project jsdom 2>&1 | tail -10
```

Expected: PASS (these files were already passing; only their names changed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: rename .vitest.ts files to .svelte.test.ts convention"
```

---

## Phase 7 — Cleanup

### Task 22: Remove the old config drop the temp glob, delete bun preload

**Files:**

- Delete: `bunfig.toml`
- Delete: `src/test-setup.ts`
- Modify: `vitest.config.ts` (remove the temporary `*.vitest.ts` include + coverage exclude)

- [ ] **Step 1: Delete bun test infra**

```bash
git rm bunfig.toml src/test-setup.ts
```

- [ ] **Step 2: Remove the temp `.vitest.ts` references in `vitest.config.ts`**

In `vitest.config.ts`, delete `'src/**/*.vitest.ts'` from the coverage `exclude` array, delete it from the node project's `exclude` array, and change the jsdom project's `include` to:

```ts
					include: ['src/**/*.svelte.test.ts'],
```

- [ ] **Step 3: Verify the full suite (both projects) runs green**

```bash
bun run vitest run 2>&1 | tail -15
```

Expected: PASS across node + jsdom, zero `bun:test` references.

- [ ] **Step 4: Confirm no `bun:test` imports remain**

```bash
grep -rn "bun:test" src ; echo "exit=$?"
```

Expected: no matches (`exit=1`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: remove bunfig.toml, bun preload, and temp vitest globs"
```

### Task 23: Update package.json scripts and remove @types/bun

**Files:** Modify `package.json`

- [ ] **Step 1:** Update the `scripts` block so `test` runs the full Vitest suite, and keep watch/UI helpers:

```json
		"test": "vitest run",
		"test:watch": "vitest",
		"test:unit": "vitest run",
		"test:unit:watch": "vitest",
		"test:e2e": "playwright test",
		"test:e2e:ui": "playwright test --ui",
```

- [ ] **Step 2:** Remove `"@types/bun": "^1.3.3",` from `devDependencies`.
- [ ] **Step 3: Reinstall to update the lockfile**

```bash
bun install
```

- [ ] **Step 4: Verify type-check and lint still pass (catches any lingering `@types/bun` usage)**

```bash
bun run check 2>&1 | tail -8
bun run lint 2>&1 | tail -8
```

Expected: both PASS. If `bun run check` reports a missing `bun` type, find the offending non-test file and replace the bun-specific type; only restore `@types/bun` if a non-test source genuinely needs it.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: point test scripts at vitest, drop @types/bun"
```

---

## Phase 8 — CI

### Task 24: Collapse the CI workflow to one Vitest job

**Files:** Modify `.github/workflows/test.yml`

- [ ] **Step 1:** Replace the two test steps (`Run Bun unit tests with coverage` and `Run Vitest component tests with coverage`) with a single Vitest step, and simplify the failure-comment + codecov steps. Replace from the `Run Bun unit tests` step through the `Upload coverage` step with:

````yaml
- name: Run unit tests with coverage
  id: vitest
  continue-on-error: true
  env:
    NEON_AUTH_BASE_URL: https://placeholder.neon.auth
    DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
  run: |
    bun run test -- --coverage --coverage.reporter=lcov --coverage.reportsDirectory=coverage 2>&1 | tee /tmp/vitest-output.txt
    exit "${PIPESTATUS[0]}"

- name: Post failure output as PR comment
  if: github.event_name == 'pull_request' && steps.vitest.outcome == 'failure'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      let body = '## CI Test Failure Debug Output\n\n';
      try {
        const out = fs.readFileSync('/tmp/vitest-output.txt', 'utf8').split('\n');
        body += '### Vitest output (first 150 lines)\n```\n' + out.slice(0, 150).join('\n') + '\n```\n\n';
        body += '### Vitest output (last 60 lines)\n```\n' + out.slice(-60).join('\n') + '\n```\n';
      } catch (e) { body += 'vitest output unavailable\n'; }
      if (context.payload.pull_request) {
        await github.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: context.payload.pull_request.number,
          body
        });
      }

- name: Fail if tests failed
  if: steps.vitest.outcome == 'failure'
  run: exit 1

- name: Upload coverage to Codecov
  if: success()
  uses: codecov/codecov-action@v5
  with:
    files: coverage/lcov.info
````

- [ ] **Step 2: Lint the YAML locally (syntax sanity)**

```bash
bun x --yes yaml-lint .github/workflows/test.yml 2>&1 | tail -3 || echo "yaml-lint unavailable; visually confirm indentation"
```

Expected: no YAML errors.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run a single vitest job with merged coverage"
```

---

## Phase 9 — Docs

### Task 25: Update CLAUDE.md testing guidance

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1:** In the "Testing" section, replace the three-runner description and the `bun test` block with the new model. Replace the Testing section's runner list and commands with:

````markdown
The project uses Vitest (two projects, environment by filename) plus Playwright for E2E:

```bash
# Vitest unit + component tests
bun run test               # Run the full suite (node + jsdom projects)
bun run test:watch         # Watch mode
bun run vitest run --project node    # Only node (logic/server) tests
bun run vitest run --project jsdom   # Only jsdom (component/DOM) tests

# Playwright E2E
bun run test:e2e
bun run test:e2e:ui
```

**File naming conventions**:

- `*.test.ts` — Vitest node-environment tests (pure logic, server load functions, API handlers)
- `*.svelte.test.ts` — Vitest jsdom-environment tests (Svelte components, runes hooks, canvas/DOM)
- `e2e/*.spec.ts` — Playwright E2E tests
````

- [ ] **Step 2:** Search `CLAUDE.md` for any other `bun test` / `*.test.ts - Bun` references and update them to the new convention.

```bash
grep -n "bun test\|Bun unit\|\.vitest\.ts" CLAUDE.md
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update testing guidance for vitest-only suite"
```

---

## Phase 10 — Final verification

### Task 26: Whole-suite green + guardrail + counts

**Files:** none (verification + optional scratch)

- [ ] **Step 1: Full suite**

```bash
bun run test 2>&1 | tail -20
```

Expected: all tests pass across both projects; the summary shows two projects (`node`, `jsdom`).

- [ ] **Step 2: No bun test residue anywhere**

```bash
grep -rn "bun:test" src ; echo "src exit=$?"
ls bunfig.toml src/test-setup.ts 2>&1   # expect: No such file
grep -rn "\"@types/bun\"" package.json ; echo "types exit=$?"
find src -name "*.vitest.ts" ; echo "vitest-ext done"
```

Expected: no `bun:test` matches, files gone, `@types/bun` gone, no `.vitest.ts` files.

- [ ] **Step 3: Coverage guardrail — every baseline test name still exists**

```bash
grep -rhoE "^\s*(test|it)\(\s*['\"\`][^'\"\`]+" src --include="*.test.ts" --include="*.svelte.test.ts" \
  | sed -E "s/^\s*(test|it)\(\s*['\"\`]//" | sort -u > /tmp/after-names.txt
comm -23 <(sort -u /tmp/baseline-names.txt) /tmp/after-names.txt
```

Expected: **empty output** — every unique test name from the baseline is still present. If any names print, they were dropped during a merge; restore them.

- [ ] **Step 4: Type-check and lint**

```bash
bun run check 2>&1 | tail -6
bun run lint 2>&1 | tail -6
```

Expected: both PASS.

- [ ] **Step 5: Record the final count and push**

```bash
bun run test 2>&1 | grep -iE "Tests +[0-9]+ passed"
git push -u origin migrate-bun-to-vitest
```

Expected: a passing count printed; branch pushed. Open a PR and confirm the single CI Vitest job is green.

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** Two projects (Tasks 1–2); naming convention (Tasks 10, 21, 25); conversion incl. hoisting (Recipes A–C, Tasks 3–9); merges as union (Recipe D, Tasks 11–20); deletions of `bunfig.toml`/`test-setup.ts`/`@types/bun` (Tasks 22–23); CI collapse (Task 24); CLAUDE.md (Task 25); count guardrail (Tasks 0, 26). All spec sections map to tasks.
- **Risk hotspots:** Recipe C files (Tasks 7–9, 14) — verify each mocked module is actually intercepted (a mistyped specifier silently no-ops). The `vi.hoisted` state object is the key correctness pattern.
- **Fallback rule** covers any node/jsdom misclassification without blocking progress.
