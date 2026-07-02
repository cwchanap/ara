# Chaos Module Refactor Implementation Plan

> **STATUS (2026-07-01): SUPERSEDED for Milestone 4+.** Milestones 1–3 plus the partial renderer layer (Milestone 2) are complete on branch `refactor/chaos-module-scaffold`: 10 of 16 pages migrated to `VisualizationShell` (henon, lozi, logistic, rossler, standard, newton, bifurcation-logistic, bifurcation-henon, chaos-esthetique, lyapunov), D3 helpers + `D3PointMapRenderer` base in place, `ConfigAlerts` deleted.
>
> **Stale references below:** this doc still mentions `VisualizationContainer` (deleted — its responsibilities folded into `VisualizationShell`) and `onExtraParametersLoaded` (dropped from the shipped shell; the shell currently only exposes `onParametersLoaded` → `applyLoadedValues` for slider clamping). The 6 remaining pages (clifford, ikeda, gumowski-mira, chua, double-pendulum, lorenz) require non-slider state restoration (colorMode/renderMode/sub-controls) and are tracked in the follow-up epic: [`docs/superpowers/plans/2026-07-01-chaos-module-milestone-4.md`](./2026-07-01-chaos-module-milestone-4.md). That epic re-introduces the `onExtraParametersLoaded` hook before any complex-page migration.
>
> Milestone 5 (cleanup & full verification) is also deferred to the follow-up epic.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the duplicated chrome/markup/config-loading across the 16 chaos pages into a declarative `VisualizationShell` + `paramDefs` schema, dedup the 9 D3 renderers behind shared helpers + a `D3PointMapRenderer` base, and extract inline renderer math into pure modules — without changing behavior.

**Architecture:** A per-map `ParamDef[]` schema is the single source of truth for slider UI, `getParameters()`, and config-load application. `VisualizationShell` renders the header, action buttons, alerts, control panel (auto sliders + formula), renderer container, info panel, and Save/Share dialogs, internalizing `useConfigLoader` and the save/share hooks. It consumes the previously-orphaned components (`VisualizationHeader`, `ParameterSlider`, `ParameterPanel`, `VisualizationErrorBoundary`); `VisualizationContainer` is deleted (its responsibilities folded into `VisualizationShell`) and `ConfigAlerts` is deleted. D3 renderers share `d3-chaos.ts` helpers; the 5 homogeneous point maps become thin wrappers over `D3PointMapRenderer`.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), TailwindCSS v4, D3.js, Vitest (node + jsdom projects), Testing Library, Playwright.

## Global Constraints

- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`, `$bindable`). No `$:` reactive statements.
- TypeScript strict mode. No `any`. Use the discriminated union `ChaosMapParameters` from `src/lib/types.ts`.
- **Preserve behavior / keep tests green.** The migrated DOM MUST keep: exact slider `id`/`for` attribute, exact displayed `decimals`, exact title text, and the same component import paths (`$lib/components/ui/SaveConfigDialog.svelte`, `ShareDialog.svelte`, `SnapshotButton.svelte`, `VisualizationAlerts.svelte`, and `$lib/components/visualizations/<Map>Renderer.svelte`) so existing `vi.mock(...)` calls still apply.
- Slider committed-value updates must be immediate (no debounce) to match current pages: shell passes `debounce={false}` to `ParameterSlider`.
- Sci-fi aesthetic unchanged: neon cyan `#00f3ff` (`COLOR_PRIMARY`), magenta `#bc13fe` (`COLOR_SECONDARY`), Orbitron/Rajdhani fonts, corner decor, `LIVE_RENDER // <ENGINE>` badge.
- Use existing constants from `src/lib/constants.ts` (`D3_CHART_MARGIN`, `COLOR_PRIMARY`, `COLOR_SECONDARY`, `VIZ_CONTAINER_HEIGHT`, `SLIDER_DEBOUNCE_MS`). Do not hardcode their values.
- Test file naming: `*.test.ts` = node env (pure logic); `*.svelte.test.ts` = jsdom env (components/DOM).
- Run `bun run check && bun run lint && bun run test` before each commit that changes TS/Svelte. Run `bun run test:e2e` once at the end (Task 30).
- Commit after every task (frequent commits). Conventional-commit messages. End commit messages with the project's required trailers (see CLAUDE.md / git config).
- Work on branch `refactor/chaos-module-scaffold` (already created).

## File Structure

**Create:**

- `src/lib/viz/types.ts` — `ParamDef` interface + `paramDefaults()`/`clampToDef()` helpers.
- `src/lib/viz/schemas/<map>.ts` — one `paramDefs` array per migrated map (16 files).
- `src/lib/viz/d3-chaos.ts` — shared D3 helpers (svg/scales/axes/gradient plot).
- `src/lib/components/ui/VisualizationShell.svelte` — the declarative page scaffold.
- `src/lib/components/visualizations/D3PointMapRenderer.svelte` — base for point-plot maps.
- `src/lib/henon.ts`, `src/lib/logistic.ts`, `src/lib/lyapunov-map.ts`, `src/lib/chaos-esthetique.ts` — extracted pure math (names chosen to avoid clashing with `src/lib/lorenz/lyapunov.ts`).
- Test files paired with each of the above.

**Modify:**

- The 4 reused orphan components (`ParameterSlider`, `ParameterPanel`, `VisualizationErrorBoundary`, `VisualizationHeader`) — small prop additions only.
- The 9 D3 renderers — route through helpers / `D3PointMapRenderer`.
- The 4 inline-math renderers — import extracted math.
- All 16 `src/routes/<map>/+page.svelte` — adopt `VisualizationShell`.

**Delete:**

- `src/lib/components/ui/ConfigAlerts.svelte` + `ConfigAlerts.svelte.test.ts`.
- `src/lib/components/ui/VisualizationContainer.svelte` (responsibilities folded into `VisualizationShell`).

---

# Milestone 1 — Core abstractions (no page changes yet)

### Task 1: ParamDef schema types + helpers

**Files:**

- Create: `src/lib/viz/types.ts`
- Test: `src/lib/viz/types.test.ts`

**Interfaces:**

- Produces:
  - `interface ParamDef { key: string; id?: string; label: string; min: number; max: number; step: number; decimals?: number; default: number }`
  - `paramDefaults(defs: ParamDef[]): Record<string, number>` — `{ [key]: default }`.
  - `clampToDef(def: ParamDef, value: number): number` — clamp to `[min, max]`.
  - `applyLoadedValues(defs: ParamDef[], values: Record<string, number>, loaded: Record<string, unknown>): void` — for each def, if `loaded[key]` is a finite number, set `values[key] = clampToDef(def, loaded[key])`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/viz/types.test.ts
import { describe, it, expect } from 'vitest';
import { paramDefaults, clampToDef, applyLoadedValues, type ParamDef } from './types';

const defs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.01, decimals: 3, default: 1.4 },
	{ key: 'iterations', label: 'Iterations', min: 100, max: 5000, step: 100, default: 2000 }
];

describe('paramDefaults', () => {
	it('builds a values map from defaults', () => {
		expect(paramDefaults(defs)).toEqual({ a: 1.4, iterations: 2000 });
	});
});

describe('clampToDef', () => {
	it('clamps below min and above max, passes through in-range', () => {
		expect(clampToDef(defs[0], 0.1)).toBe(0.5);
		expect(clampToDef(defs[0], 9)).toBe(1.5);
		expect(clampToDef(defs[0], 1.0)).toBe(1.0);
	});
});

describe('applyLoadedValues', () => {
	it('applies and clamps finite loaded numbers, ignores others', () => {
		const values = paramDefaults(defs);
		applyLoadedValues(defs, values, { a: 99, iterations: 'x', missing: 1 });
		expect(values).toEqual({ a: 1.5, iterations: 2000 });
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/viz/types.test.ts`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/viz/types.ts
export interface ParamDef {
	/** Field name in the map's ChaosMapParameters union member. */
	key: string;
	/** DOM id / label `for`. Defaults to `key` when omitted. */
	id?: string;
	/** Visible slider label (must match the page's current label text). */
	label: string;
	min: number;
	max: number;
	step: number;
	/** value.toFixed(decimals); omit ⇒ integer display (decimals = 0). */
	decimals?: number;
	default: number;
}

export function paramDefaults(defs: ParamDef[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const d of defs) out[d.key] = d.default;
	return out;
}

export function clampToDef(def: ParamDef, value: number): number {
	return Math.min(def.max, Math.max(def.min, value));
}

export function applyLoadedValues(
	defs: ParamDef[],
	values: Record<string, number>,
	loaded: Record<string, unknown>
): void {
	for (const d of defs) {
		const v = loaded[d.key];
		if (typeof v === 'number' && Number.isFinite(v)) {
			values[d.key] = clampToDef(d, v);
		}
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/viz/types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/types.ts src/lib/viz/types.test.ts
git commit -m "feat(viz): add ParamDef schema types and value helpers"
```

---

### Task 2: Extend ParameterSlider for `id` independence + no-debounce

**Files:**

- Modify: `src/lib/components/ui/ParameterSlider.svelte`
- Test: `src/lib/components/ui/ParameterSlider.svelte.test.ts` (extend existing)

**Interfaces:**

- Consumes: existing `ParameterSlider` props (`id`, `label`, `value` (bindable), `min`, `max`, `step`, `decimals`, `debounce`, `debounceMs`, `onchange`).
- Produces: behavior where `debounce={false}` commits `value` synchronously on input (already supported — this task adds a regression test and confirms the displayed value updates immediately regardless of debounce).

> No code change is needed if the existing component already commits synchronously when `debounce={false}` and updates the displayed value from `internalValue`. This task LOCKS that behavior with tests so later shell work can rely on it.

- [ ] **Step 1: Add failing tests**

```ts
// append to src/lib/components/ui/ParameterSlider.svelte.test.ts
import { render, fireEvent, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ParameterSlider from './ParameterSlider.svelte';

describe('ParameterSlider no-debounce + id', () => {
	it('uses the provided id on the input and label for', () => {
		const { container } = render(ParameterSlider, {
			props: { id: 'param-a', label: 'a', value: 1, min: 0, max: 2, step: 0.1, decimals: 3 }
		});
		expect(container.querySelector('input[id="param-a"]')).toBeTruthy();
		expect(container.querySelector('label[for="param-a"]')).toBeTruthy();
	});

	it('commits value immediately and shows formatted value when debounce=false', async () => {
		const { container } = render(ParameterSlider, {
			props: {
				id: 'a',
				label: 'a',
				value: 1,
				min: 0,
				max: 2,
				step: 0.001,
				decimals: 3,
				debounce: false
			}
		});
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.5' } });
		expect(screen.getByText('1.500')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run tests**

Run: `bun run vitest run src/lib/components/ui/ParameterSlider.svelte.test.ts`
Expected: PASS if behavior already exists; if the `debounce=false` path does not commit synchronously, FAIL.

- [ ] **Step 3: Implement only if a test failed**

If the synchronous-commit test failed, ensure the `else` branch in `handleInput` assigns `value = newValue` and calls `onchange?.(newValue)` with no timer (it already does in the current source). Make no change if tests pass.

- [ ] **Step 4: Re-run tests**

Run: `bun run vitest run src/lib/components/ui/ParameterSlider.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/ParameterSlider.svelte.test.ts src/lib/components/ui/ParameterSlider.svelte
git commit -m "test(ui): lock ParameterSlider id + no-debounce behavior for shell reuse"
```

---

### Task 3: Add formula-column control to ParameterPanel

**Files:**

- Modify: `src/lib/components/ui/ParameterPanel.svelte`
- Test: `src/lib/components/ui/ParameterPanel.svelte.test.ts` (extend existing)

**Interfaces:**

- Produces: `ParameterPanel` gains `paramColumns?: 1 | 2 | 3` (default 3) and `equationColumns?: 1 | 2 | 3` (default 3), applied to the slider grid and the equations grid respectively, so a page like henon (2 formula columns) renders identically.

- [ ] **Step 1: Add failing test**

```ts
// append to src/lib/components/ui/ParameterPanel.svelte.test.ts
import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ParameterPanel from './ParameterPanel.svelte';
import { createRawSnippet } from 'svelte';

const body = createRawSnippet(() => ({ render: () => '<div data-testid="kids">x</div>' }));
const eqs = createRawSnippet(() => ({ render: () => '<p>eq</p>' }));

describe('ParameterPanel columns', () => {
	it('applies equationColumns to the equations grid', () => {
		const { container } = render(ParameterPanel, {
			props: { children: body, equations: eqs, equationColumns: 2 }
		});
		expect(container.querySelector('.md\\:grid-cols-2')).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run test**

Run: `bun run vitest run src/lib/components/ui/ParameterPanel.svelte.test.ts`
Expected: FAIL — no `md:grid-cols-2` element (equations grid is hardcoded to 3).

- [ ] **Step 3: Implement**

In `ParameterPanel.svelte`, add props and use a static class map (Tailwind needs literal class names, not interpolation):

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		title?: string;
		children: Snippet;
		equations?: Snippet;
		paramColumns?: 1 | 2 | 3;
		equationColumns?: 1 | 2 | 3;
	}
	let {
		title = 'SYSTEM_PARAMETERS',
		children,
		equations,
		paramColumns = 3,
		equationColumns = 3
	}: Props = $props();
	const COLS: Record<1 | 2 | 3, string> = {
		1: 'md:grid-cols-1',
		2: 'md:grid-cols-2',
		3: 'md:grid-cols-3'
	};
</script>
```

Replace the slider grid class `grid grid-cols-1 md:grid-cols-3 gap-8` with `grid grid-cols-1 {COLS[paramColumns]} gap-8`, and the equations grid `grid grid-cols-1 md:grid-cols-3 gap-4 ...` with `grid grid-cols-1 {COLS[equationColumns]} gap-4 ...`. Keep all other markup identical.

- [ ] **Step 4: Run tests**

Run: `bun run vitest run src/lib/components/ui/ParameterPanel.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/ParameterPanel.svelte src/lib/components/ui/ParameterPanel.svelte.test.ts
git commit -m "feat(ui): add column controls to ParameterPanel"
```

---

### Task 4: Build VisualizationShell

**Files:**

- Create: `src/lib/components/ui/VisualizationShell.svelte`
- Test: `src/lib/components/ui/VisualizationShell.svelte.test.ts`

**Interfaces:**

- Consumes: `ParamDef`, `paramDefaults`, `applyLoadedValues` (Task 1); `ParameterPanel` (Task 3), `ParameterSlider` (Task 2), `VisualizationHeader`, `VisualizationContainer`, `VisualizationErrorBoundary`, `VisualizationAlerts`, `SaveConfigDialog`, `ShareDialog`, `SnapshotButton`; `useConfigLoader` + `createInitialConfigLoaderState` (`$lib/use-config-loader`); `createSaveHandler`/`createInitialSaveState` (`$lib/use-visualization-save`); `createShareHandler`/`createInitialShareState` (`$lib/use-visualization-share`); `checkParameterStability` (`$lib/chaos-validation`); `buildComparisonUrl`/`createComparisonStateFromCurrent` (`$lib/comparison-url-state`); `base` (`$app/paths`); `page` (`$app/stores`).
- Produces: `VisualizationShell` with props:

```ts
import type { Snippet } from 'svelte';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
import type { ParamDef } from '$lib/viz/types';

interface RendererArgs {
	values: Record<string, number>;
	container: { el?: HTMLElement };
}
interface Props {
	mapType: ChaosMapType;
	title: string;
	moduleNumber?: string;
	paramDefs: ParamDef[];
	buildParameters: (values: Record<string, number>) => ChaosMapParameters;
	formula: string[];
	formulaColumns?: 1 | 2 | 3;
	paramColumns?: 1 | 2 | 3;
	description: { heading: string; body: string };
	isAuthenticated: boolean;
	showSnapshot?: boolean; // default true
	renderEngine?: string; // VisualizationContainer badge; default 'D3_JS'
	onExtraParametersLoaded?: (params: ChaosMapParameters) => void;
	renderer: Snippet<[RendererArgs]>;
	extraControls?: Snippet;
}
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/ui/VisualizationShell.svelte.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import {
	authedPageProps,
	resetMockPageStore,
	restoreFetch,
	setMockPageUrl,
	setupApiFetchMock
} from '$lib/components/testing/page-test-helpers';
import VisualizationShell from './VisualizationShell.svelte';
import type { ParamDef } from '$lib/viz/types';

vi.mock('$app/stores', async () => {
	const { mockPageStore } = await import('$lib/components/testing/page-test-helpers');
	return { page: mockPageStore };
});
vi.mock('$app/paths', async () => {
	const { BASE_PATH } = await import('$lib/components/testing/page-test-helpers');
	return { base: BASE_PATH };
});
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/components/ui/SaveConfigDialog.svelte', async () => ({
	default: (await import('$lib/components/testing/DialogStub.svelte')).default
}));
vi.mock('$lib/components/ui/ShareDialog.svelte', async () => ({
	default: (await import('$lib/components/testing/DialogStub.svelte')).default
}));
vi.mock('$lib/components/ui/SnapshotButton.svelte', async () => ({
	default: (await import('$lib/components/testing/StubComponent.svelte')).default
}));
vi.mock('$lib/components/ui/VisualizationAlerts.svelte', async () => ({
	default: (await import('$lib/components/testing/VisualizationAlertsStub.svelte')).default
}));

const defs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.001, decimals: 3, default: 1.4 }
];
const renderer = createRawSnippet(() => ({ render: () => '<div data-testid="renderer"></div>' }));

function renderShell() {
	return render(VisualizationShell, {
		props: {
			mapType: 'henon',
			title: 'HÉNON_MAP',
			moduleNumber: '02',
			paramDefs: defs,
			buildParameters: (v: Record<string, number>) => ({
				type: 'henon',
				a: v.a,
				b: 0.3,
				iterations: 2000
			}),
			formula: ['x(n+1) = …'],
			description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc' },
			isAuthenticated: true,
			renderer,
			...authedPageProps
		} as never
	});
}

describe('VisualizationShell', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setupApiFetchMock();
		setMockPageUrl('http://localhost/henon');
	});
	afterEach(() => {
		vi.useRealTimers();
		restoreFetch();
		resetMockPageStore();
		cleanup();
	});

	it('renders title, the renderer snippet, and an auto slider from the schema', () => {
		const { container } = renderShell();
		expect(screen.getByText('HÉNON_MAP')).toBeInTheDocument();
		expect(screen.getByTestId('renderer')).toBeInTheDocument();
		expect(container.querySelector('input[id="a"]')).toBeTruthy();
	});

	it('updates the displayed value when the schema slider changes', async () => {
		const { container } = renderShell();
		const input = container.querySelector('input[id="a"]') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1.2' } });
		expect(screen.getByText('1.200')).toBeInTheDocument();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/components/ui/VisualizationShell.svelte.test.ts`
Expected: FAIL — cannot find `./VisualizationShell.svelte`.

- [ ] **Step 3: Implement the shell**

```svelte
<!-- src/lib/components/ui/VisualizationShell.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
	import type { ParamDef } from '$lib/viz/types';
	import { paramDefaults, applyLoadedValues } from '$lib/viz/types';
	import VisualizationHeader from '$lib/components/ui/VisualizationHeader.svelte';
	import ParameterPanel from '$lib/components/ui/ParameterPanel.svelte';
	import ParameterSlider from '$lib/components/ui/ParameterSlider.svelte';
	import VisualizationContainer from '$lib/components/ui/VisualizationContainer.svelte';
	import VisualizationErrorBoundary from '$lib/components/ui/VisualizationErrorBoundary.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';

	interface RendererArgs {
		values: Record<string, number>;
		container: { el?: HTMLElement };
	}
	interface Props {
		mapType: ChaosMapType;
		title: string;
		moduleNumber?: string;
		paramDefs: ParamDef[];
		buildParameters: (values: Record<string, number>) => ChaosMapParameters;
		formula: string[];
		formulaColumns?: 1 | 2 | 3;
		paramColumns?: 1 | 2 | 3;
		description: { heading: string; body: string };
		isAuthenticated: boolean;
		showSnapshot?: boolean;
		renderEngine?: string;
		onExtraParametersLoaded?: (params: ChaosMapParameters) => void;
		renderer: Snippet<[RendererArgs]>;
		extraControls?: Snippet;
	}
	let {
		mapType,
		title,
		moduleNumber,
		paramDefs,
		buildParameters,
		formula,
		formulaColumns = 3,
		paramColumns = 3,
		description,
		isAuthenticated,
		showSnapshot = true,
		renderEngine = 'D3_JS',
		onExtraParametersLoaded,
		renderer,
		extraControls
	}: Props = $props();

	const values = $state(paramDefaults(paramDefs));
	const container = $state<{ el?: HTMLElement }>({});

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());
	const configState = $state(createInitialConfigLoaderState());

	function getParameters(): ChaosMapParameters {
		return buildParameters(values);
	}

	const { save: handleSave, cleanup: cleanupSave } = createSaveHandler(
		mapType,
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShare } = createShareHandler(
		mapType,
		shareState,
		getParameters
	);

	let comparisonUrl = $state('');
	$effect(() => {
		// Track all slider values.
		for (const d of paramDefs) void values[d.key];
		comparisonUrl = buildComparisonUrl(
			base,
			mapType,
			createComparisonStateFromCurrent(mapType, getParameters())
		);
	});

	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType,
				base,
				onParametersLoaded: (params) => {
					applyLoadedValues(paramDefs, values, params as Record<string, unknown>);
					onExtraParametersLoaded?.(params as ChaosMapParameters);
					return getParameters() as never;
				},
				onCheckStability: (params) => checkParameterStability(mapType, params as never)
			},
			configState
		);
		return cleanup;
	});

	$effect(() => () => {
		cleanupSave();
		cleanupShare();
	});
</script>

<div class="space-y-6">
	<VisualizationHeader {title} {moduleNumber}>
		{#if showSnapshot}
			<SnapshotButton target={container.el} targetType="container" {mapType} />
		{/if}
		{#if comparisonUrl}
			<a
				href={comparisonUrl}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>⊞ Compare</a
			>
		{:else}
			<span
				aria-disabled="true"
				class="px-6 py-2 bg-primary/10 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold opacity-50 cursor-not-allowed"
				>⊞ Compare</span
			>
		{/if}
		<button
			onclick={() => (shareState.showShareDialog = true)}
			class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>🔗 Share</button
		>
		<button
			onclick={() => (saveState.showSaveDialog = true)}
			class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>💾 Save</button
		>
	</VisualizationHeader>

	<VisualizationAlerts
		saveSuccess={saveState.saveSuccess}
		saveError={saveState.saveError}
		configErrors={configState.errors}
		showConfigError={configState.showError}
		onDismissConfigError={() => (configState.showError = false)}
		stabilityWarnings={configState.warnings}
		showStabilityWarning={configState.showWarning}
		onDismissStabilityWarning={() => (configState.showWarning = false)}
		onDismissSaveError={() => (saveState.saveError = null)}
		onDismissSaveSuccess={() => (saveState.saveSuccess = false)}
	/>

	<ParameterPanel {paramColumns} equationColumns={formulaColumns}>
		{#each paramDefs as def (def.key)}
			<ParameterSlider
				id={def.id ?? def.key}
				label={def.label}
				bind:value={values[def.key]}
				min={def.min}
				max={def.max}
				step={def.step}
				decimals={def.decimals ?? 0}
				debounce={false}
			/>
		{/each}
		{#if extraControls}{@render extraControls()}{/if}
		{#snippet equations()}
			{#each formula as line}<p>{line}</p>{/each}
		{/snippet}
	</ParameterPanel>

	<VisualizationContainer {renderEngine} bind:containerRef={container.el}>
		<VisualizationErrorBoundary {mapType}>
			{@render renderer({ values, container })}
		</VisualizationErrorBoundary>
	</VisualizationContainer>

	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">{description.heading}</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">{description.body}</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	{mapType}
	{isAuthenticated}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>
<ShareDialog
	bind:open={shareState.showShareDialog}
	{mapType}
	{isAuthenticated}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
```

> Note on the container binding: `VisualizationContainer` binds its root to `containerRef`; here we bind it to `container.el` so `SnapshotButton` and the renderer snippet share the same element reference. If the renderer needs its OWN inner element (D3 renderers create their own root), the renderer snippet may instead bind the renderer's `containerElement` to `container.el` — both patterns set `container.el`; pick per page in the migration tasks. Default pages use the `VisualizationContainer` root for snapshot.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/components/ui/VisualizationShell.svelte.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check + commit**

Run: `bun run check`
Expected: no new errors.

```bash
git add src/lib/components/ui/VisualizationShell.svelte src/lib/components/ui/VisualizationShell.svelte.test.ts
git commit -m "feat(ui): add declarative VisualizationShell scaffold"
```

---

### Task 5: Delete ConfigAlerts (orphan, superseded by VisualizationAlerts)

**Files:**

- Delete: `src/lib/components/ui/ConfigAlerts.svelte`, `src/lib/components/ui/ConfigAlerts.svelte.test.ts`

- [ ] **Step 1: Confirm zero non-test usage**

Run: `grep -rn "ConfigAlerts" src/ --include="*.svelte" --include="*.ts" | grep -v "ConfigAlerts.svelte"`
Expected: no output (only the files being deleted reference it).

- [ ] **Step 2: Delete files**

```bash
git rm src/lib/components/ui/ConfigAlerts.svelte src/lib/components/ui/ConfigAlerts.svelte.test.ts
```

- [ ] **Step 3: Verify suite still green**

Run: `bun run check && bun run vitest run --project jsdom`
Expected: PASS, no missing-import errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(ui): remove orphaned ConfigAlerts (superseded by VisualizationAlerts)"
```

---

# Milestone 2 — Renderer layer

### Task 6: D3 chaos helpers (`d3-chaos.ts`)

**Files:**

- Create: `src/lib/viz/d3-chaos.ts`
- Test: `src/lib/viz/d3-chaos.test.ts`

**Interfaces:**

- Consumes: `d3`, `D3_CHART_MARGIN`, `COLOR_PRIMARY`, `COLOR_SECONDARY` from `$lib/constants`.
- Produces:
  - `makeLinearScales(points, opts: { width: number; height: number; pad?: number })` → `{ xScale, yScale, xExtent, yExtent }` using `domain([min-pad, max+pad])`, default `pad = 0.1`; falls back to `[-1, 1]` for empty input.
  - `gradientColor(t: number): string` → `d3.interpolate(COLOR_PRIMARY, COLOR_SECONDARY)(t)`.
  - `drawSciFiAxes(svg, xScale, yScale, opts: { width: number; height: number; labels?: { x: string; y: string } })` → appends styled axis groups (cyan ticks, removed domain line) and optional axis text.
  - `plotGradientPoints(svg, points, opts: { xScale; yScale; r?: number; opacity?: number; glow?: boolean })` → appends circles colored by `gradientColor(i / points.length)`.

> `makeLinearScales` and `gradientColor` are pure and unit-testable in node env. `drawSciFiAxes`/`plotGradientPoints` operate on a d3 selection; test them via a jsdom SVG in a separate `.svelte.test.ts` if desired, but the core math lives in the pure functions.

- [ ] **Step 1: Write the failing test (pure functions)**

```ts
// src/lib/viz/d3-chaos.test.ts
import { describe, it, expect } from 'vitest';
import { makeLinearScales, gradientColor } from './d3-chaos';

describe('makeLinearScales', () => {
	it('pads extents by 0.1 and maps to ranges', () => {
		const pts: [number, number][] = [
			[0, 0],
			[2, 4]
		];
		const { xScale, yScale, xExtent, yExtent } = makeLinearScales(pts, { width: 100, height: 50 });
		expect(xExtent).toEqual([0, 2]);
		expect(yExtent).toEqual([0, 4]);
		expect(xScale.domain()).toEqual([-0.1, 2.1]);
		expect(yScale.domain()).toEqual([-0.1, 4.1]);
		expect(xScale.range()).toEqual([0, 100]);
		expect(yScale.range()).toEqual([50, 0]); // inverted
	});

	it('falls back to [-1,1] for empty input', () => {
		const { xExtent } = makeLinearScales([], { width: 10, height: 10 });
		expect(xExtent).toEqual([-1, 1]);
	});
});

describe('gradientColor', () => {
	it('returns endpoints at t=0 and t=1', () => {
		expect(gradientColor(0)).toBeTruthy();
		expect(gradientColor(1)).toBeTruthy();
		expect(gradientColor(0)).not.toEqual(gradientColor(1));
	});
});
```

- [ ] **Step 2: Run test**

Run: `bun run vitest run src/lib/viz/d3-chaos.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/viz/d3-chaos.ts
import * as d3 from 'd3';
import { COLOR_PRIMARY, COLOR_SECONDARY } from '$lib/constants';

export function gradientColor(t: number): string {
	return d3.interpolate(COLOR_PRIMARY, COLOR_SECONDARY)(t);
}

export function makeLinearScales(
	points: [number, number][],
	opts: { width: number; height: number; pad?: number }
) {
	const pad = opts.pad ?? 0.1;
	const xRaw = d3.extent(points, (d) => d[0]);
	const yRaw = d3.extent(points, (d) => d[1]);
	const xExtent: [number, number] = [xRaw[0] ?? -1, xRaw[1] ?? 1];
	const yExtent: [number, number] = [yRaw[0] ?? -1, yRaw[1] ?? 1];
	const xScale = d3
		.scaleLinear()
		.domain([xExtent[0] - pad, xExtent[1] + pad])
		.range([0, opts.width]);
	const yScale = d3
		.scaleLinear()
		.domain([yExtent[0] - pad, yExtent[1] + pad])
		.range([opts.height, 0]);
	return { xScale, yScale, xExtent, yExtent };
}

type SvgG = d3.Selection<SVGGElement, unknown, null, undefined>;
type Scale = d3.ScaleLinear<number, number>;

export function drawSciFiAxes(
	svg: SvgG,
	xScale: Scale,
	yScale: Scale,
	opts: { width: number; height: number; labels?: { x: string; y: string } }
) {
	const style = (g: d3.Selection<SVGGElement, unknown, null, undefined>) => {
		g.select('.domain').remove();
		g.selectAll('line').attr('stroke', COLOR_PRIMARY).attr('stroke-opacity', 0.1);
		g.selectAll('text')
			.attr('fill', COLOR_PRIMARY)
			.attr('font-family', 'Rajdhani')
			.attr('font-size', '12px');
	};
	svg
		.append('g')
		.attr('transform', `translate(0,${opts.height})`)
		.call(d3.axisBottom(xScale).tickSize(-opts.height).tickPadding(10))
		.call(style);
	svg.append('g').call(d3.axisLeft(yScale).tickSize(-opts.width).tickPadding(10)).call(style);
	if (opts.labels) {
		svg
			.append('text')
			.attr('x', opts.width / 2)
			.attr('y', opts.height + 40)
			.attr('fill', COLOR_PRIMARY)
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text(opts.labels.x);
		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('x', -opts.height / 2)
			.attr('y', -40)
			.attr('fill', COLOR_PRIMARY)
			.attr('text-anchor', 'middle')
			.attr('font-family', 'Orbitron')
			.attr('font-size', '14px')
			.text(opts.labels.y);
	}
}

export function plotGradientPoints(
	svg: SvgG,
	points: [number, number][],
	opts: { xScale: Scale; yScale: Scale; r?: number; opacity?: number; glow?: boolean }
) {
	const sel = svg
		.selectAll('circle')
		.data(points)
		.enter()
		.append('circle')
		.attr('cx', (d) => opts.xScale(d[0]))
		.attr('cy', (d) => opts.yScale(d[1]))
		.attr('r', opts.r ?? 2)
		.attr('fill', (_d, i) => gradientColor(points.length > 0 ? i / points.length : 0))
		.attr('opacity', opts.opacity ?? 0.8);
	if (opts.glow) sel.attr('filter', 'drop-shadow(0 0 2px rgba(0, 243, 255, 0.5))');
}
```

- [ ] **Step 4: Run test**

Run: `bun run vitest run src/lib/viz/d3-chaos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/d3-chaos.ts src/lib/viz/d3-chaos.test.ts
git commit -m "feat(viz): add shared D3 chaos helpers (scales, axes, gradient plot)"
```

---

### Task 7: D3PointMapRenderer base component

**Files:**

- Create: `src/lib/components/visualizations/D3PointMapRenderer.svelte`
- Test: `src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts`

**Interfaces:**

- Consumes: `makeLinearScales`, `drawSciFiAxes`, `plotGradientPoints` (Task 6); `D3_CHART_MARGIN`, `VIZ_CONTAINER_HEIGHT` from `$lib/constants`.
- Produces: a component with props:

```ts
interface Props {
	points: [number, number][]; // already-computed orbit (page/wrapper computes via its lib module)
	height?: number;
	containerElement?: HTMLDivElement; // bindable
	axisLabels?: { x: string; y: string };
	r?: number;
	opacity?: number;
	glow?: boolean;
	chrome?: 'plain' | 'decorated'; // 'plain' = LoziRenderer chrome, 'decorated' = HenonRenderer corner-decor chrome
}
```

> Renderers pass already-computed `points` (keeping math in `lib/*.ts`), so this base is purely presentational and trivially testable.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import D3PointMapRenderer from './D3PointMapRenderer.svelte';

afterEach(cleanup);

it('renders an svg with one circle per point', async () => {
	const points: [number, number][] = [
		[0, 0],
		[1, 1],
		[2, 0.5]
	];
	const { container } = render(D3PointMapRenderer, { props: { points, height: 200 } });
	// jsdom has no layout; component must guard width===0. Force a width:
	const root = container.querySelector('div') as HTMLDivElement;
	Object.defineProperty(root, 'clientWidth', { value: 400, configurable: true });
	// trigger a re-render by updating points
	await new Promise((r) => setTimeout(r, 0));
	// At minimum the LIVE_RENDER badge is present:
	expect(container.textContent).toContain('LIVE_RENDER');
});
```

> NOTE: jsdom reports `clientWidth = 0`, so circle-count assertions are unreliable in jsdom (the existing renderer tests handle this the same way — assert badge/markup, not geometry). Keep geometry assertions out of jsdom; they live in the pure `d3-chaos` tests (Task 6).

- [ ] **Step 2: Run test**

Run: `bun run vitest run src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```svelte
<!-- src/lib/components/visualizations/D3PointMapRenderer.svelte -->
<script lang="ts">
	import * as d3 from 'd3';
	import { D3_CHART_MARGIN, VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { makeLinearScales, drawSciFiAxes, plotGradientPoints } from '$lib/viz/d3-chaos';

	interface Props {
		points: [number, number][];
		height?: number;
		containerElement?: HTMLDivElement;
		axisLabels?: { x: string; y: string };
		r?: number;
		opacity?: number;
		glow?: boolean;
		chrome?: 'plain' | 'decorated';
	}
	let {
		points,
		height = VIZ_CONTAINER_HEIGHT,
		containerElement = $bindable(),
		axisLabels,
		r,
		opacity,
		glow = false,
		chrome = 'plain'
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	$effect(() => {
		containerElement = container;
	});

	function render() {
		if (!container) return;
		d3.select(container).selectAll('*').remove();
		const m = D3_CHART_MARGIN;
		const width = Math.max(0, container.clientWidth - m.left - m.right);
		const chartHeight = Math.max(0, height - m.top - m.bottom);
		if (width === 0 || chartHeight === 0) return;
		const svg = d3
			.select(container)
			.append('svg')
			.attr('width', container.clientWidth)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${m.left},${m.top})`);
		if (points.length === 0) {
			const { xScale, yScale } = makeLinearScales(points, { width, height: chartHeight });
			drawSciFiAxes(svg, xScale, yScale, { width, height: chartHeight, labels: axisLabels });
			return;
		}
		const { xScale, yScale } = makeLinearScales(points, { width, height: chartHeight });
		drawSciFiAxes(svg, xScale, yScale, { width, height: chartHeight, labels: axisLabels });
		plotGradientPoints(svg, points, { xScale, yScale, r, opacity, glow });
	}

	$effect(() => {
		void points;
		void height;
		if (container) render();
	});
</script>

{#if chrome === 'decorated'}
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/30 rounded-sm overflow-hidden relative backdrop-blur-md ring-1 ring-primary/30 shadow-[0_0_25px_rgba(0,243,255,0.25),0_0_45px_rgba(255,0,255,0.15)]"
		style="height: {height}px;"
	>
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
		<div
			class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/80 border border-primary/40 bg-black/60 backdrop-blur-sm px-2 py-1 pointer-events-none select-none shadow-[0_0_12px_rgba(0,243,255,0.35)]"
		>
			LIVE_RENDER // D3_JS
		</div>
	</div>
{:else}
	<div
		bind:this={container}
		class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
		style="height: {height}px;"
	>
		<div
			class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
		>
			LIVE_RENDER // D3_JS
		</div>
	</div>
{/if}
```

- [ ] **Step 4: Run test**

Run: `bun run vitest run src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/visualizations/D3PointMapRenderer.svelte src/lib/components/visualizations/D3PointMapRenderer.svelte.test.ts
git commit -m "feat(viz): add D3PointMapRenderer base for point-plot maps"
```

---

### Task 8: Extract Henon math to `lib/henon.ts`

**Files:**

- Create: `src/lib/henon.ts`, `src/lib/henon.test.ts`
- Modify: `src/lib/components/visualizations/HenonRenderer.svelte` (import + use the module)

**Interfaces:**

- Produces: `calculateHenonTuples(params: { a: number; b: number; iterations: number }): [number, number][]` — same loop currently inline in `HenonRenderer` (guards: break on non-finite or `|value| > 1e6`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/henon.test.ts
import { describe, it, expect } from 'vitest';
import { calculateHenonTuples } from './henon';

describe('calculateHenonTuples', () => {
	it('produces the classic attractor orbit deterministically', () => {
		const pts = calculateHenonTuples({ a: 1.4, b: 0.3, iterations: 5 });
		expect(pts.length).toBe(5);
		expect(pts[0]).toEqual([1, 0]); // x=y+1-a*0=1, y=b*0=0
	});
	it('returns empty for zero iterations', () => {
		expect(calculateHenonTuples({ a: 1.4, b: 0.3, iterations: 0 })).toEqual([]);
	});
	it('stops early on divergence', () => {
		const pts = calculateHenonTuples({ a: 5, b: 1, iterations: 1000 });
		expect(pts.length).toBeLessThan(1000);
	});
});
```

- [ ] **Step 2: Run test** — `bun run vitest run src/lib/henon.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — move the inline loop verbatim:

```ts
// src/lib/henon.ts
export interface HenonCalcParams {
	a: number;
	b: number;
	iterations: number;
}

export function calculateHenonTuples({ a, b, iterations }: HenonCalcParams): [number, number][] {
	const points: [number, number][] = [];
	let x = 0,
		y = 0;
	for (let i = 0; i < iterations; i++) {
		const xNew = y + 1 - a * x * x;
		const yNew = b * x;
		if (!Number.isFinite(xNew) || !Number.isFinite(yNew)) break;
		if (Math.abs(xNew) > 1e6 || Math.abs(yNew) > 1e6) break;
		points.push([xNew, yNew]);
		x = xNew;
		y = yNew;
	}
	return points;
}
```

- [ ] **Step 4: Update HenonRenderer to use it**

In `HenonRenderer.svelte`, delete the inline `calculateHenon` function and `import { calculateHenonTuples } from '$lib/henon';`, replacing the call `const points = calculateHenon(a, b, iterations);` with `const points = calculateHenonTuples({ a, b, iterations });`.

- [ ] **Step 5: Run tests** — `bun run vitest run src/lib/henon.test.ts src/lib/components/visualizations/HenonRenderer.svelte.test.ts && bun run check` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/henon.ts src/lib/henon.test.ts src/lib/components/visualizations/HenonRenderer.svelte
git commit -m "refactor(henon): extract map math into lib/henon.ts"
```

---

### Task 9: Extract Logistic math to `lib/logistic.ts`

**Files:**

- Create: `src/lib/logistic.ts`, `src/lib/logistic.test.ts`
- Modify: `src/lib/components/visualizations/LogisticRenderer.svelte`

**Interfaces:**

- Produces: a pure function mirroring `LogisticRenderer`'s current inline math (read the renderer first to copy the exact recurrence and return shape; logistic typically returns the time series `xₙ₊₁ = r·xₙ·(1−xₙ)`).

- [ ] **Step 1:** Read `LogisticRenderer.svelte`, identify the inline `calculate*` function, copy its exact signature/return shape into the test as the expected behavior (deterministic first few values for `r`, `x0`, `iterations`).
- [ ] **Step 2:** Run the new test — Expected: FAIL (module missing).
- [ ] **Step 3:** Move the inline function verbatim into `src/lib/logistic.ts`; export it.
- [ ] **Step 4:** Import it in `LogisticRenderer.svelte`, delete the inline copy.
- [ ] **Step 5:** Run `bun run vitest run src/lib/logistic.test.ts src/lib/components/visualizations/LogisticRenderer.svelte.test.ts && bun run check` — Expected: PASS.
- [ ] **Step 6:** Commit `refactor(logistic): extract map math into lib/logistic.ts`.

---

### Task 10: Extract Lyapunov renderer math to `lib/lyapunov-map.ts`

**Files:**

- Create: `src/lib/lyapunov-map.ts`, `src/lib/lyapunov-map.test.ts`
- Modify: `src/lib/components/visualizations/LyapunovRenderer.svelte`

> Use the name `lyapunov-map.ts` to avoid clashing with the existing `src/lib/lorenz/lyapunov.ts`.

- [ ] **Step 1:** Read `LyapunovRenderer.svelte`; copy the inline exponent computation's exact behavior into a test (deterministic output for a small `rMin/rMax/iterations/transientIterations`).
- [ ] **Step 2:** Run test — Expected: FAIL.
- [ ] **Step 3:** Move math verbatim into `src/lib/lyapunov-map.ts`; export it.
- [ ] **Step 4:** Import in `LyapunovRenderer.svelte`, delete inline copy.
- [ ] **Step 5:** `bun run vitest run src/lib/lyapunov-map.test.ts src/lib/components/visualizations/LyapunovRenderer.svelte.test.ts && bun run check` — Expected: PASS.
- [ ] **Step 6:** Commit `refactor(lyapunov): extract renderer math into lib/lyapunov-map.ts`.

---

### Task 11: Extract Chaos Esthetique math to `lib/chaos-esthetique.ts`

**Files:**

- Create: `src/lib/chaos-esthetique.ts`, `src/lib/chaos-esthetique.test.ts`
- Modify: `src/lib/components/visualizations/ChaosEsthetiqueRenderer.svelte`

- [ ] **Step 1:** Read `ChaosEsthetiqueRenderer.svelte`; capture the inline `calculate*` exact behavior in a test.
- [ ] **Step 2:** Run test — Expected: FAIL.
- [ ] **Step 3:** Move math verbatim into `src/lib/chaos-esthetique.ts`; export it.
- [ ] **Step 4:** Import in renderer; delete inline copy.
- [ ] **Step 5:** `bun run vitest run src/lib/chaos-esthetique.test.ts src/lib/components/visualizations/ChaosEsthetiqueRenderer.svelte.test.ts && bun run check` — Expected: PASS.
- [ ] **Step 6:** Commit `refactor(chaos-esthetique): extract renderer math into lib module`.

---

### Task 12: Route the 5 point-map renderers through D3PointMapRenderer

**Files:**

- Modify: `HenonRenderer.svelte`, `LoziRenderer.svelte`, `CliffordRenderer.svelte`, `IkedaRenderer.svelte`, `GumowskiMiraRenderer.svelte`
- Tests: existing `*Renderer.svelte.test.ts` for each.

**Interfaces:**

- Consumes: `D3PointMapRenderer` (Task 7), each map's `calculate*Tuples` (`lib/henon.ts`, `lib/lozi.ts`, `lib/clifford.ts`, `lib/ikeda.ts`, `lib/gumowski-mira.ts`).

> Do these ONE renderer per commit. For each: compute `points` via the lib module in a `$derived`, then render `<D3PointMapRenderer {points} {height} bind:containerElement chrome={...} r={...} opacity={...} axisLabels={...} glow={...} />` with values chosen to match that renderer's current output (henon: `chrome="decorated"`, `r={2}`, `opacity={0.8}`, `glow`, `axisLabels={{x:'X_AXIS',y:'Y_AXIS'}}`; lozi: `chrome="plain"`, `r={1.5}`, `opacity={0.7}`, no labels). Verify against the existing renderer test after each.

For EACH renderer (repeat steps; example shown for Lozi):

- [ ] **Step A: Rewrite the renderer to delegate**

```svelte
<!-- LoziRenderer.svelte -->
<script lang="ts">
	import { calculateLoziTuples } from '$lib/lozi';
	import D3PointMapRenderer from './D3PointMapRenderer.svelte';
	interface Props {
		a?: number;
		b?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		height?: number;
		containerElement?: HTMLDivElement;
	}
	let {
		a = 1.7,
		b = 0.5,
		x0 = 0,
		y0 = 0,
		iterations = 5000,
		height = 500,
		containerElement = $bindable()
	}: Props = $props();
	const points = $derived(calculateLoziTuples({ a, b, x0, y0, iterations }));
</script>

<D3PointMapRenderer {points} {height} bind:containerElement chrome="plain" r={1.5} opacity={0.7} />
```

- [ ] **Step B: Run that renderer's test**

Run: `bun run vitest run src/lib/components/visualizations/LoziRenderer.svelte.test.ts`
Expected: PASS. If the test asserts on inner markup the wrapper no longer emits, adjust the test to assert through `D3PointMapRenderer` output (badge, container class) — do NOT weaken geometry coverage that already lives in `d3-chaos`/lib tests.

- [ ] **Step C: Commit** `refactor(lozi): render via D3PointMapRenderer`.

Repeat A–C for Henon (decorated chrome, labels, glow), Clifford, Ikeda, Gumowski-Mira — **matching each one's current `r`/`opacity`/`glow`/`chrome`/`axisLabels` exactly** (read each current renderer to copy those values). Keep any renderer that has bespoke color modes (clifford/ikeda/gumowski-mira may color by iteration/seed/radius rather than the simple index gradient) on its existing custom draw path IF `D3PointMapRenderer`'s single gradient cannot reproduce it — in that case, route only its axis/scale/chrome through the helpers and leave point coloring custom. Decide per renderer by comparing to its test expectations.

---

# Milestone 3 — Migrate the 10 slider-only pages

> **Migration recipe (applies to every page task below):**
>
> 1. Create `src/lib/viz/schemas/<map>.ts` exporting `<map>ParamDefs: ParamDef[]`. **Transcribe each slider's exact `id` (the `for`/`id` in the current page), `label` text, `min`, `max`, `step`, default value, and decimals (count the digits in the current `{x.toFixed(n)}`; integer display ⇒ omit `decimals`).** The current page file is the authoritative source.
> 2. Write/adjust the schema test asserting defaults + a couple of bounds.
> 3. Replace the page `<script>`/markup with the `VisualizationShell` usage (template below), supplying `buildParameters`, `formula` (copy the exact formula lines from the current page), `description` (copy the current `DATA_LOG` heading + body verbatim), `moduleNumber`, and the renderer snippet.
> 4. Run that page's existing tests (`<map>-page-interactions.svelte.test.ts`, `<map>-config-loading.svelte.test.ts`) + `bun run check`. They must pass unchanged. If a test fails ONLY due to changed value-display decimals or a slider `id`, the schema transcription is wrong — fix the schema, not the test.
> 5. Commit `refactor(<map>): adopt VisualizationShell`.

**Page template:**

```svelte
<script lang="ts">
  import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
  import <Map>Renderer from '$lib/components/visualizations/<Map>Renderer.svelte';
  import { <map>ParamDefs } from '$lib/viz/schemas/<map>';
  import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
  import type { <Map>Parameters } from '$lib/types';
  let { data } = $props();
</script>

<VisualizationShell
  mapType="<map>" title="<TITLE>" moduleNumber="<NN>"
  paramDefs={<map>ParamDefs}
  buildParameters={(v): <Map>Parameters => ({ type: '<map>', /* map v.* + constants */ })}
  formula={[/* exact lines */]} formulaColumns={<2|3>}
  description={{ heading: '<DATA_LOG heading>', body: '<body>' }}
  isAuthenticated={!!data?.session}
  showSnapshot={<true unless this page lacks SnapshotButton today>}>
  {#snippet renderer({ values, container })}
    <<Map>Renderer {...mapValues} bind:containerElement={container.el} height={VIZ_CONTAINER_HEIGHT} />
  {/snippet}
</VisualizationShell>
```

### Task 13: Migrate **henon** (canonical worked example)

**Files:**

- Create: `src/lib/viz/schemas/henon.ts`, `src/lib/viz/schemas/henon.test.ts`
- Modify: `src/routes/henon/+page.svelte`
- Tests: `src/routes/henon-page-interactions.svelte.test.ts`, `src/routes/henon-config-loading.svelte.test.ts` (must pass unchanged).

- [ ] **Step 1: Schema + test**

```ts
// src/lib/viz/schemas/henon.ts
import type { ParamDef } from '$lib/viz/types';
export const henonParamDefs: ParamDef[] = [
	{ key: 'a', label: 'a', min: 0.5, max: 1.5, step: 0.01, decimals: 3, default: 1.4 },
	{ key: 'b', label: 'b', min: 0, max: 1, step: 0.01, decimals: 3, default: 0.3 },
	{ key: 'iterations', label: 'Iterations', min: 100, max: 5000, step: 100, default: 2000 }
];
```

```ts
// src/lib/viz/schemas/henon.test.ts
import { describe, it, expect } from 'vitest';
import { paramDefaults } from '$lib/viz/types';
import { henonParamDefs } from './henon';
describe('henonParamDefs', () => {
	it('matches the current page defaults and ids', () => {
		expect(paramDefaults(henonParamDefs)).toEqual({ a: 1.4, b: 0.3, iterations: 2000 });
		expect(henonParamDefs.map((d) => d.id ?? d.key)).toEqual(['a', 'b', 'iterations']);
	});
});
```

- [ ] **Step 2: Run schema test** — `bun run vitest run src/lib/viz/schemas/henon.test.ts` — Expected: PASS.

- [ ] **Step 3: Rewrite the page**

```svelte
<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import HenonRenderer from '$lib/components/visualizations/HenonRenderer.svelte';
	import { henonParamDefs } from '$lib/viz/schemas/henon';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import type { HenonParameters } from '$lib/types';
	let { data } = $props();
</script>

<VisualizationShell
	mapType="henon"
	title="HÉNON_MAP"
	moduleNumber="02"
	paramDefs={henonParamDefs}
	buildParameters={(v): HenonParameters => ({
		type: 'henon',
		a: v.a,
		b: v.b,
		iterations: v.iterations
	})}
	formula={['x(n+1) = y(n) + 1 - a·x(n)²', 'y(n+1) = b·x(n)']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: HÉNON_MAP',
		body: 'The Hénon map is a discrete-time dynamical system introduced by Michel Hénon as a simplified model of the Poincaré section of the Lorenz model. For certain parameter values, the map exhibits chaotic behavior and produces a strange attractor.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet renderer({ values, container })}
		<HenonRenderer
			a={values.a}
			b={values.b}
			iterations={values.iterations}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
```

- [ ] **Step 4: Run page tests + check**

Run: `bun run vitest run src/routes/henon-page-interactions.svelte.test.ts src/routes/henon-config-loading.svelte.test.ts && bun run check`
Expected: PASS. (If a slider isn't found by `input[id="a"]` or a `1.500`-style value text is missing, fix the schema `id`/`decimals`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/viz/schemas/henon.ts src/lib/viz/schemas/henon.test.ts src/routes/henon/+page.svelte
git commit -m "refactor(henon): adopt VisualizationShell + paramDefs schema"
```

### Tasks 14–22: Migrate the remaining 9 slider-only pages

Apply the migration recipe + page template once per page, one commit each. Per-page specifics (keys → `buildParameters`; remember to transcribe exact bounds/ids/decimals/formula/description from the current file):

- [ ] **Task 14 — rossler** (`moduleNumber` 09, formula 3-col, **no SnapshotButton today ⇒ `showSnapshot={false}`**). Slider ids are `param-a`/`param-b`/`param-c` (set `id` in the schema; `key` is `a`/`b`/`c`). `buildParameters: (v) => ({ type: 'rossler', a: v.a, b: v.b, c: v.c })`.
- [ ] **Task 15 — logistic**. Keys `r`, `x0`, `iterations`. `buildParameters: (v) => ({ type: 'logistic', r: v.r, x0: v.x0, iterations: v.iterations })`.
- [ ] **Task 16 — lozi**. Keys `a, b, x0, y0, iterations`. `buildParameters: (v) => ({ type: 'lozi', a: v.a, b: v.b, x0: v.x0, y0: v.y0, iterations: v.iterations })`.
- [ ] **Task 17 — newton**. Keys `xMin, xMax, yMin, yMax, maxIterations`. `buildParameters: (v) => ({ type: 'newton', xMin: v.xMin, xMax: v.xMax, yMin: v.yMin, yMax: v.yMax, maxIterations: v.maxIterations })`.
- [ ] **Task 18 — standard**. Keys `k, numP, numQ, iterations`. `buildParameters: (v) => ({ type: 'standard', k: v.k, numP: v.numP, numQ: v.numQ, iterations: v.iterations })`.
- [ ] **Task 19 — bifurcation-logistic**. Keys `rMin, rMax, maxIterations`. `buildParameters: (v) => ({ type: 'bifurcation-logistic', rMin: v.rMin, rMax: v.rMax, maxIterations: v.maxIterations })`.
- [ ] **Task 20 — bifurcation-henon**. Keys `aMin, aMax, b, maxIterations`. `buildParameters: (v) => ({ type: 'bifurcation-henon', aMin: v.aMin, aMax: v.aMax, b: v.b, maxIterations: v.maxIterations })`.
- [ ] **Task 21 — chaos-esthetique**. Keys `a, b, x0, y0, iterations`. `buildParameters: (v) => ({ type: 'chaos-esthetique', a: v.a, b: v.b, x0: v.x0, y0: v.y0, iterations: v.iterations })`.
- [ ] **Task 22 — lyapunov** (**no SnapshotButton today ⇒ `showSnapshot={false}`**). Keys `rMin, rMax, iterations, transientIterations`. `buildParameters: (v) => ({ type: 'lyapunov', rMin: v.rMin, rMax: v.rMax, iterations: v.iterations, transientIterations: v.transientIterations })`.

Each task: schema file + test → page rewrite → `bun run vitest run src/routes/<map>-page-interactions.svelte.test.ts src/routes/<map>-config-loading.svelte.test.ts && bun run check` (PASS) → commit `refactor(<map>): adopt VisualizationShell`.

---

# Milestone 4 — Migrate the 5 complex pages (with `extraControls`)

> **Complex recipe:** same as Milestone 3, plus: the page keeps `$state` for the non-slider controls (selects/checkboxes/sub-components) and renders them inside the `extraControls` snippet. Fold those into `buildParameters` and handle them in `onExtraParametersLoaded`. The sliders still come from the schema. Read the current page to copy the exact extra-control markup (selects, options, checkbox, sub-components).

### Task 23: Migrate **clifford** (canonical complex example)

**Files:**

- Create: `src/lib/viz/schemas/clifford.ts` (+ test)
- Modify: `src/routes/clifford/+page.svelte`
- Tests: `clifford-page-interactions`, `clifford-config-loading` (+ `clifford-compare-interactions` if it imports the page).

Sliders (schema): `a, b, c, d, iterations, zoom, pointSize, opacity` (transcribe exact bounds/ids/decimals). Extra control: `colorMode` (a `<select>`), kept in page `$state`.

- [ ] **Step 1: Schema + test** (defaults match current page).
- [ ] **Step 2:** Run schema test — PASS.
- [ ] **Step 3: Rewrite page**

```svelte
<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import CliffordRenderer from '$lib/components/visualizations/CliffordRenderer.svelte';
	import { cliffordParamDefs } from '$lib/viz/schemas/clifford';
	import {
		CLIFFORD_COLOR_MODES,
		type CliffordColorMode,
		type CliffordParameters
	} from '$lib/types';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	let { data } = $props();
	let colorMode = $state<CliffordColorMode>('single');

	function build(v: Record<string, number>): CliffordParameters {
		return {
			type: 'clifford',
			a: v.a,
			b: v.b,
			c: v.c,
			d: v.d,
			iterations: v.iterations,
			zoom: v.zoom,
			pointSize: v.pointSize,
			opacity: v.opacity,
			colorMode
		};
	}
	function applyExtras(p: CliffordParameters) {
		if (p.colorMode) colorMode = p.colorMode;
	}
</script>

<VisualizationShell
	mapType="clifford"
	title="CLIFFORD_ATTRACTOR"
	moduleNumber="<NN>"
	paramDefs={cliffordParamDefs}
	buildParameters={build}
	formula={[
		/* exact lines from current page */
	]}
	description={{ heading: 'DATA_LOG: CLIFFORD_ATTRACTOR', body: '<body>' }}
	isAuthenticated={!!data?.session}
	onExtraParametersLoaded={(p) => applyExtras(p as CliffordParameters)}
>
	{#snippet extraControls()}
		<!-- paste the current colorMode <select> block verbatim, bind:value={colorMode} -->
	{/snippet}
	{#snippet renderer({ values, container })}
		<CliffordRenderer
			a={values.a}
			b={values.b}
			c={values.c}
			d={values.d}
			iterations={values.iterations}
			zoom={values.zoom}
			pointSize={values.pointSize}
			opacity={values.opacity}
			{colorMode}
			bind:containerElement={container.el}
			height={VIZ_CONTAINER_HEIGHT}
		/>
	{/snippet}
</VisualizationShell>
```

- [ ] **Step 4:** `bun run vitest run src/routes/clifford-page-interactions.svelte.test.ts src/routes/clifford-config-loading.svelte.test.ts && bun run check` — Expected: PASS. Adjust the `extraControls` markup until the select test passes (same option values/labels/id as before).
- [ ] **Step 5:** Commit `refactor(clifford): adopt VisualizationShell with extraControls`.

### Tasks 24–27: Migrate the remaining complex pages

Apply the complex recipe, one commit each, copying each page's extra controls verbatim into `extraControls` and folding them through `buildParameters`/`onExtraParametersLoaded`:

- [ ] **Task 24 — ikeda**. Sliders: `u, x0, y0, iterations, burnIn, seeds, pointSize, opacity`. Extras: `renderMode`, `colorMode` (selects). `seeds`/`burnIn` are integers (decimals omitted). Build `{ type: 'ikeda', ...sliders, renderMode, colorMode }`.
- [ ] **Task 25 — gumowski-mira**. Sliders: `mu, a, b, x0, y0, iterations, burnIn, seeds, pointSize, opacity`. Extras: `renderMode`, `colorMode`. Build `{ type: 'gumowski-mira', ... }`.
- [ ] **Task 26 — chua**. Sliders: `alpha, beta, gamma, a, b` (+ session-only `dt`, `trailLength` — see note). Extras: `colorMode`, `poincarePlane` (selects) + 1 checkbox. **Only `alpha/beta/gamma/a/b` are persisted** (`ChuaParameters`); keep `dt`/`trailLength`/checkbox/selects as page state passed to the renderer but NOT in `buildParameters` (matches current persistence). Build `{ type: 'chua', alpha, beta, gamma, a, b }`.
- [ ] **Task 27 — double-pendulum**. Sliders: `theta1, theta2, omega1, omega2, l1, l2, m1, m2, gravity, damping, speed, trailLength, compareOffset` (13). No selects/checkboxes in the schema scan, but it has bespoke play/compare controls — render those via `extraControls` if present. Build the full `DoublePendulumParameters` (initial conditions + physical params + optional sim/render fields) per `types.ts`.

Each: schema + test → page rewrite (with `extraControls`) → `bun run vitest run src/routes/<map>-page-interactions.svelte.test.ts src/routes/<map>-config-loading.svelte.test.ts && bun run check` (PASS; also run `<map>-compare-interactions` if it imports the page) → commit.

### Task 28: Migrate **lorenz** (3D, 8 sub-controls)

**Files:**

- Create: `src/lib/viz/schemas/lorenz.ts` (+ test) — sliders `sigma, rho, beta` only.
- Modify: `src/routes/lorenz/+page.svelte`
- Tests: `lorenz-page-interactions`, `lorenz-config-loading`, `lorenz-compare-interactions`.

> Lorenz uses the 8 sub-components under `src/lib/components/visualizations/lorenz/` (ColorModeSelector, PlaybackControls, ViewControls, TrailControls, SolverControls, InitialStateControls, PresetSelector, ChaosIndicator) and has many optional `LorenzParameters` fields. Put the three core sliders (`sigma/rho/beta`) in the schema; render ALL sub-components inside `extraControls`, keep their state as page `$state`, and fold everything into `buildParameters`/`onExtraParametersLoaded`. `renderEngine="THREE_JS"`. Renderer snippet renders `<LorenzRenderer .../>` binding its container to `container.el`.

- [ ] **Step 1:** Schema (`sigma/rho/beta` with exact bounds/ids/decimals) + test.
- [ ] **Step 2:** Run schema test — PASS.
- [ ] **Step 3:** Rewrite the page: move all sub-controls into `extraControls`, build the full `LorenzParameters` (core + optional fields currently persisted) in `buildParameters`, restore them in `onExtraParametersLoaded`. Keep `renderEngine="THREE_JS"`.
- [ ] **Step 4:** `bun run vitest run src/routes/lorenz-page-interactions.svelte.test.ts src/routes/lorenz-config-loading.svelte.test.ts src/routes/lorenz-compare-interactions.svelte.test.ts && bun run check` — Expected: PASS.
- [ ] **Step 5:** Commit `refactor(lorenz): adopt VisualizationShell with sub-control extras`.

---

# Milestone 5 — Cleanup & full verification

### Task 29: Confirm no orphans / dead code remain

- [ ] **Step 1:** Verify all reusable shared components now have non-test consumers:

Run:

```bash
for c in VisualizationHeader ParameterSlider ParameterPanel VisualizationContainer VisualizationErrorBoundary VisualizationShell; do
  echo "$c:"; grep -rl "$c" src/ --include="*.svelte" --include="*.ts" | grep -v ".test." | grep -v "/$c.svelte" | grep -v "VisualizationShell.svelte$" || true
done
```

Expected: each (except `VisualizationShell` itself) is imported by `VisualizationShell.svelte`; `VisualizationShell` is imported by all 16 pages.

- [ ] **Step 2:** Verify no inline `calculate` math remains in renderer components:

Run: `grep -rln "function calculate" src/lib/components/visualizations/*.svelte`
Expected: no output (or only renderers explicitly kept custom in Task 12, documented in the commit).

- [ ] **Step 3:** Verify all 16 pages use the shell and none keep the old inline loader:

Run:

```bash
grep -L "VisualizationShell" src/routes/{lorenz,rossler,henon,lozi,logistic,newton,standard,chua,clifford,ikeda,gumowski-mira,double-pendulum,bifurcation-logistic,bifurcation-henon,chaos-esthetique,lyapunov}/+page.svelte
grep -rl "loadSavedConfigParameters" src/routes/*/+page.svelte
```

Expected: first command lists nothing; second lists nothing (all loading now goes through the shell's `useConfigLoader`).

- [ ] **Step 4:** Commit any stray cleanup `chore: remove dead chaos-page boilerplate` (if Steps 1–3 surfaced leftovers).

### Task 30: Full verification gate

- [ ] **Step 1:** `bun run check` — Expected: 0 errors.
- [ ] **Step 2:** `bun run lint` — Expected: clean (run `bun run format` if Prettier flags formatting).
- [ ] **Step 3:** `bun run test` — Expected: full node + jsdom suites PASS.
- [ ] **Step 4:** `bun run test:e2e` — Expected: Playwright e2e PASS.
- [ ] **Step 5:** Final commit if formatting changed: `chore: format after chaos module refactor`.

---

## Self-Review

**Spec coverage:**

- Param schema single-source-of-truth → Tasks 1, 13–28 (schemas) + shell wiring (Task 4). ✓
- `VisualizationShell` reviving 5 orphans → Tasks 2, 3, 4. ✓
- Delete `ConfigAlerts` → Task 5. ✓
- D3 helpers + `D3PointMapRenderer` → Tasks 6, 7, 12. ✓
- Math extraction (henon, logistic, lyapunov, chaos-esthetique) → Tasks 8–11. ✓
- Unify config-loading on `useConfigLoader` → internalized in shell (Task 4), applied by all migrations (Tasks 13–28), verified Task 29 Step 3. ✓
- Migrate 10 slider-only pages → Tasks 13–22. ✓
- Migrate 5 complex pages via `extraControls` → Tasks 23–28. ✓
- Preserve behavior / tests green → recipe Step 4 in every migration + Task 30. ✓
- Snapshot consistency (rossler/lyapunov lack the button) → `showSnapshot={false}` in Tasks 14, 22. ✓
- Error handling via `VisualizationErrorBoundary` → wired in shell (Task 4). ✓

**Placeholder scan:** Migration tasks intentionally instruct transcription of exact bounds/formula/description **from the authoritative current page file** (a mechanical, verifiable step), with henon (Task 13) and clifford (Task 23) fully worked as templates. Tasks 9–11 instruct "read the renderer, copy exact inline math" because that math is the source of truth and must be moved verbatim — not invented. No vague "add error handling"/"write tests for the above" placeholders remain.

**Type consistency:** `ParamDef`, `paramDefaults`, `clampToDef`, `applyLoadedValues` (Task 1) are used consistently in Tasks 4 and all schemas. `buildParameters: (values: Record<string, number>) => ChaosMapParameters` is consistent shell↔page. Renderer helper names `makeLinearScales`/`drawSciFiAxes`/`plotGradientPoints`/`gradientColor` (Task 6) match their uses in Tasks 7 and 12. `calculateHenonTuples` (Task 8) matches its use in Task 12 Henon wrapper.

## Execution Handoff

(Offered after this plan is saved.)
