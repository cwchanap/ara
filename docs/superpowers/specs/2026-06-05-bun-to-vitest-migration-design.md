# Migrate `bun test` → Vitest (Unified Suite)

**Date:** 2026-06-05
**Status:** Approved design

## Problem

The repo runs three test systems. Two of them overlap and create maintenance
friction:

- **`bun test`** — 49 files importing `bun:test`, driven by `bunfig.toml` and a
  large preload (`src/test-setup.ts`) that hand-stubs SvelteKit virtual modules.
- **Vitest** — 62 `.vitest.ts` files (jsdom), using the real `sveltekit()` Vite
  plugin.
- **Playwright** — 6 `e2e/*.spec.ts` files (out of scope).

The `.vitest.ts` extension exists only to avoid collisions with `bun:test`.
Ten source modules have tests in **both** systems, with complementary (not
redundant) cases. The goal is to retire `bun test`, consolidate everything onto
Vitest, and merge the overlapping pairs.

## Goal

A single Vitest invocation runs all unit/component tests. No `bun:test` imports
remain. Bun stays as the package manager and runtime (`bun install`,
`bun run`); only the `bun test` *runner* is removed. Playwright E2E is untouched.

## Target Architecture

A single Vitest config with **two projects**, environment selected by filename:

| Project | Environment | Include glob | Purpose |
| --- | --- | --- | --- |
| `node` | `node` | `src/**/*.test.ts` (excl. `*.svelte.test.ts`) | Pure logic, server load functions, API handlers, db schema |
| `jsdom` | `jsdom` | `src/**/*.svelte.test.ts` | Components, Svelte-runes hooks, canvas/DOM tests |

### Naming convention (after migration)

- **Node tests:** `foo.test.ts`
- **DOM tests:** `foo.svelte.test.ts`

This is Vitest's idiomatic projects pattern: the filename determines the
environment, so the config stays two clean globs with no hand-maintained file
lists.

### Environment placement rule

A file goes to the **jsdom** project *only if it uses DOM/browser APIs*
(component rendering, canvas, `$effect` runes touching the DOM). Everything else
— chaos math, validation, server load functions, API handlers, db schema —
is **node**.

## Conversion Strategy

### Mechanical conversion (per bun file)

- Remove `import { ... } from 'bun:test'`; rely on Vitest globals
  (`globals: true` is already configured).
- `mock(fn)` → `vi.fn()`.
- `mock.module('x', factory)` → `vi.mock('x', factory)`.
- Drop bun `mock.module` stubs that merely duplicated `src/test-setup.ts`
  (e.g. `drizzle-orm`); use the real modules instead.

### Hoisting caveat (highest-risk item)

`vi.mock()` is **hoisted to the top of the file**, unlike bun's `mock.module()`
which runs in place. The 22 files using `mock.module` must have their mock
factories made hoist-safe: no reference to outer-scope variables except through
`vi.hoisted()`. Each converted mock must be verified to still intercept the
intended module.

### Three categories of bun files

1. **~41 bun-only files** — convert in place; rename to `.test.ts` (node) or
   `.svelte.test.ts` (jsdom) per the placement rule. Default node; jsdom only
   when DOM/browser APIs are used (e.g. `snapshot` → canvas).

2. **10 overlapping pairs** — merge as a **union of unique test cases**. Neither
   side is a superset (e.g. `type-guards`: bun 16 / vitest 3; `auth-errors`:
   bun 28 / vitest 64; `chaos-validation`: bun 168 / vitest 59). Each merge
   reads both files, combines distinct `describe`/`test` blocks, dedupes
   identical cases, and lands one file. The (converted) `.vitest.ts` content is
   kept plus the bun-unique cases.

   Overlapping bases: `auth-errors`, `chaos-validation`, `lorenz/colors`,
   `saved-config-loader`, `server/profile-provisioning`, `type-guards`,
   `use-config-loader`, `use-debounced-effect`, `use-visualization-save`,
   `use-visualization-share`.

3. **`.extra` / `.bun` siblings** — fold into their base file during the merge.
   Examples:
   - `snapshot.bun.test.ts` + `snapshot.extra.test.ts` + `snapshot.vitest.ts`
     → one `snapshot.svelte.test.ts` (jsdom; canvas).
   - `chaos-validation.test.ts` + `chaos-validation.extra.test.ts` +
     `chaos-validation.vitest.ts` → one `chaos-validation.test.ts` (node).
   - `lozi.extra.test.ts`, `rossler.extra.test.ts`,
     `comparison-url-state.extra.test.ts`, `use-config-loader-catch.test.ts`,
     `use-visualization-save-catch.test.ts` fold into their bases.

## Configuration Changes

### `vitest.config.ts`

Restructure into two projects:

- **`node`**: `environment: 'node'`, `include: ['src/**/*.test.ts']`,
  `exclude: ['src/**/*.svelte.test.ts']`, setup file that sets a `DATABASE_URL`
  default (ported from the one useful behavior in `src/test-setup.ts`) to prevent
  import-time DB crashes in server tests.
- **`jsdom`**: `environment: 'jsdom'`, `include: ['src/**/*.svelte.test.ts']`,
  existing `vitest.setup.ts` (jest-dom matchers; RAF / ResizeObserver / btoa /
  atob shims).
- **Coverage**: one merged config. Port the meaningful ignore patterns from
  `bunfig.toml` (`constants.ts`, `workers/types.ts`, `lib/index.ts`, `*.d.ts`)
  and update exclude globs to the new naming. Single lcov output.

The `sveltekit()` plugin natively resolves `$env/*`, `$app/paths`, and
`@sveltejs/kit`, so those stubs are **not** ported.

### Deletions / cleanup

- Delete `bunfig.toml`.
- Delete `src/test-setup.ts` (replaced by the small node setup file).
- Remove `@types/bun` from `devDependencies` (verify no non-test usage first).
- `package.json`: `test` → `vitest run` (full suite, both projects). Consolidate
  the `test:unit*` scripts accordingly so `bun run test` runs everything.
- Update `CLAUDE.md` testing section: drop `bun test` / `*.test.ts`-is-bun
  guidance; document `.test.ts` (node) vs `.svelte.test.ts` (jsdom).
- Leave historical `docs/plans/*` and `docs/superpowers/plans/*` as-is
  (point-in-time records).

### CI (`.github/workflows/test.yml`)

- Collapse the two test steps (bun + vitest) into one Vitest run with coverage.
- Single coverage upload to Codecov (one lcov file).
- Simplify the PR-comment-on-failure step to a single output stream.
- Keep `bun install --frozen-lockfile` and `bunx svelte-kit sync`.

## Acceptance Criteria

- `bun run test` (Vitest) runs green across both projects.
- `grep -r "bun:test" src` returns nothing.
- `bun run check` (svelte-check) passes.
- `bun run lint` (ESLint + Prettier) passes.
- Total test-case count ≥ the pre-migration sum — capture counts before/after
  as a guardrail so no cases are silently dropped during merges.
- CI runs a single successful Vitest job with one coverage upload.

## Out of Scope

- Playwright E2E tests (`e2e/*.spec.ts`).
- Bun as package manager / runtime (retained).
- Adding new test coverage beyond what migration/merge preserves.
- Refactoring of non-test source code.
