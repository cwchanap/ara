# Baker's Map Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Baker's Map chaotic mixing visualization module at `/bakers-map` with animated canvas rendering, full type/validation/migration integration, compare route, and homepage card.

**Architecture:** Page-managed slider pattern (like Tinkerbell) using `VisualizationShell` with page-owned `$state` rendered in `extraControls`. The renderer is a canvas-based animation component using `Float64Array` point data, `requestAnimationFrame` loop with auto-reset at 50 iterations, and signal-counter props for reset/randomize/step controls.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Canvas 2D API, d3-interpolate, Vitest + jsdom, Drizzle migrations.

## Global Constraints

- **Runtime:** Bun (package manager, test runner)
- **Language:** TypeScript strict mode
- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$effect`, `$props`, `$bindable`, `$derived`)
- **Styling:** TailwindCSS v4, sci-fi aesthetic (neon cyan `#00f3ff`, Orbitron/Rajdhani fonts, corner borders)
- **Testing:** Vitest — `*.test.ts` for node-env tests, `*.svelte.test.ts` for jsdom-env tests
- **Precision:** `Float64Array` for all point data (NOT `Float32Array`)
- **Migration:** Manual SQL + journal entry only, NO `drizzle-kit generate` (snapshots stop at 0002)
- **Color constants:** Import from `$lib/constants` (`COLOR_PRIMARY`, `COLOR_MAGENTA`)
- **Container height:** `VIZ_CONTAINER_HEIGHT` (600px) from `$lib/constants`
- **Base path:** All routes use `{base}` from `$app/paths`

**Spec:** `docs/superpowers/specs/2026-07-10-bakers-map-visualization-design.md`

---

### Task 1: Type System Foundation

Register `'bakers-map'` across all exhaustive type maps and the validation system. These three files must land in a single commit or TypeScript will not compile (exhaustive switches, `Record<ChaosMapType, ...>` maps).

**Files:**

- Modify: `src/lib/types.ts` (lines 12-29, 286-303, 306-324, 327-345, 347-423)
- Modify: `src/lib/chaos-validation.ts` (line 26, the `STABLE_RANGES` object)
- Modify: `src/lib/comparison-url-state.ts` (lines 68-140, the `getDefaultParameters` switch)
- Test: `src/lib/chaos-validation.test.ts`

**Interfaces:**

- Produces: `BakersMapParameters` type (`{ type: 'bakers-map'; pointCount: number; speed: number }`), `'bakers-map'` in `ChaosMapType`, `STABLE_RANGES['bakers-map']`, `getDefaultParameters('bakers-map')`

- [ ] **Step 1: Write the failing validation test**

Add to the end of `src/lib/chaos-validation.test.ts`, inside the appropriate describe block for stable ranges (or create a new describe block):

```typescript
describe('bakers-map parameter validation', () => {
	const validParams = { type: 'bakers-map', pointCount: 3000, speed: 1 };

	test('validates correct bakers-map parameters', () => {
		const result = validateParameters('bakers-map', validParams);
		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test('rejects missing speed', () => {
		const result = validateParameters('bakers-map', { type: 'bakers-map', pointCount: 3000 });
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain('speed');
	});

	test('rejects missing pointCount', () => {
		const result = validateParameters('bakers-map', { type: 'bakers-map', speed: 1 });
		expect(result.isValid).toBe(false);
		expect(result.errors[0]).toContain('pointCount');
	});

	test('checkParameterStability reports out-of-range speed', () => {
		const result = checkParameterStability('bakers-map', {
			type: 'bakers-map',
			pointCount: 3000,
			speed: 100
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('speed'))).toBe(true);
	});

	test('checkParameterStability reports out-of-range pointCount', () => {
		const result = checkParameterStability('bakers-map', {
			type: 'bakers-map',
			pointCount: 999999,
			speed: 1
		});
		expect(result.isStable).toBe(false);
		expect(result.warnings.some((w) => w.includes('pointCount'))).toBe(true);
	});

	test('checkParameterStability passes for in-range values', () => {
		const result = checkParameterStability('bakers-map', validParams);
		expect(result.isStable).toBe(true);
		expect(result.warnings).toHaveLength(0);
	});
});
```

Also add an import check at the top — `validateParameters` and `checkParameterStability` should already be imported in this test file. Verify by reading the existing imports.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/chaos-validation.test.ts -- -t "bakers-map"`
Expected: FAIL — `validateParameters` doesn't know about `'bakers-map'` (the `STABLE_RANGES` key doesn't exist).

- [ ] **Step 3: Add `BakersMapParameters` to `src/lib/types.ts`**

In `src/lib/types.ts`, add the interface BEFORE the `ChaosMapParameters` union (after `DoublePendulumParameters`, around line 283):

```typescript
export interface BakersMapParameters {
	type: 'bakers-map';
	pointCount: number;
	speed: number;
}
```

- [ ] **Step 4: Register `'bakers-map'` in all type maps in `src/lib/types.ts`**

Add `'bakers-map'` to the `ChaosMapType` union (after `'double-pendulum'`, line 29):

```typescript
	| 'double-pendulum'
	| 'bakers-map';
```

Add `BakersMapParameters` to the `ChaosMapParameters` union (after `DoublePendulumParameters`, line 303):

```typescript
	| DoublePendulumParameters
	| BakersMapParameters;
```

Add to `CHAOS_MAP_DISPLAY_NAMES` (after `'double-pendulum'`, line 323):

```typescript
	'double-pendulum': 'DOUBLE_PENDULUM',
	'bakers-map': 'BAKERS_MAP'
```

Add to `VALID_MAP_TYPES` (after `'double-pendulum'`, line 344):

```typescript
('double-pendulum', 'bakers-map');
```

Add to `SavedConfiguration` union (after the `double-pendulum` arm, before the closing `)`):

```typescript
	| {
			mapType: 'bakers-map';
			parameters: BakersMapParameters;
	  }
```

- [ ] **Step 5: Add `STABLE_RANGES` entry in `src/lib/chaos-validation.ts`**

In the `STABLE_RANGES` object (after the `'double-pendulum'` entry, around line 139):

```typescript
	'double-pendulum': {
		theta1: { min: -2 * Math.PI, max: 2 * Math.PI },
		theta2: { min: -2 * Math.PI, max: 2 * Math.PI },
		omega1: { min: -50, max: 50 },
		omega2: { min: -50, max: 50 },
		l1: { min: 0.1, max: 5 },
		l2: { min: 0.1, max: 5 },
		m1: { min: 0.1, max: 10 },
		m2: { min: 0.1, max: 10 },
		gravity: { min: 0, max: 50 },
		damping: { min: 0, max: 2 }
	},
	'bakers-map': {
		pointCount: { min: 100, max: 10000 },
		speed: { min: 1, max: 10 }
	}
```

- [ ] **Step 6: Add `getDefaultParameters` case in `src/lib/comparison-url-state.ts`**

In the `getDefaultParameters` switch (before the closing `}` of the switch, after the `'tinkerbell'` case, around line 138):

```typescript
		case 'tinkerbell': {
			const preset = getTinkerbellPreset(DEFAULT_TINKERBELL_PRESET_ID);
			if (!preset)
				throw new Error(
					`Missing default Tinkerbell preset: ${DEFAULT_TINKERBELL_PRESET_ID}`
				);
			return { type: 'tinkerbell', ...preset.state };
		}
		case 'bakers-map':
			return { type: 'bakers-map', pointCount: 3000, speed: 1 };
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun run vitest run src/lib/chaos-validation.test.ts -- -t "bakers-map"`
Expected: PASS — all 6 bakers-map tests pass.

- [ ] **Step 8: Run typecheck to verify no compile errors**

Run: `bun run check`
Expected: PASS — no errors from exhaustive switch or missing Record keys.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/chaos-validation.ts src/lib/chaos-validation.test.ts src/lib/comparison-url-state.ts
git commit -m "feat: register bakers-map type, validation, and comparison defaults (HPA-63)"
```

---

### Task 2: DB Migration

Add the `'bakers-map'` map type to the database CHECK constraints. Without this, runtime Save/Share fails with a CHECK violation and `schema.test.ts` fails.

**Files:**

- Create: `drizzle/0012_add_bakers_map_map_type.sql`
- Modify: `drizzle/meta/_journal.json` (add entry at end of entries array)
- Modify: `src/lib/server/db/schema.test.ts` (line 77-83)

**Interfaces:**

- Consumes: `VALID_MAP_TYPES` from Task 1 (now includes `'bakers-map'`)

- [ ] **Step 1: Write the migration SQL**

Create `drizzle/0012_add_bakers_map_map_type.sql`:

```sql
-- Add the bakers-map map type to both configuration table constraints
-- (positioned after double-pendulum to match VALID_MAP_TYPES order)
-- Wrapped in a transaction so a mid-migration failure leaves no partial state.

BEGIN;

-- Update saved_configurations constraint with all 18 map types
ALTER TABLE "saved_configurations"
DROP CONSTRAINT IF EXISTS "check_valid_map_type";

ALTER TABLE "saved_configurations"
ADD CONSTRAINT "check_valid_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'lozi',
    'ikeda',
    'clifford',
    'tinkerbell',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'gumowski-mira',
    'lyapunov',
    'chua',
    'double-pendulum',
    'bakers-map'
));

-- Update shared_configurations constraint with all 18 map types
ALTER TABLE "shared_configurations"
DROP CONSTRAINT IF EXISTS "chk_shared_configurations_map_type";

ALTER TABLE "shared_configurations"
ADD CONSTRAINT "chk_shared_configurations_map_type"
CHECK ("map_type" IN (
    'lorenz',
    'rossler',
    'henon',
    'lozi',
    'ikeda',
    'clifford',
    'tinkerbell',
    'logistic',
    'newton',
    'standard',
    'bifurcation-logistic',
    'bifurcation-henon',
    'chaos-esthetique',
    'gumowski-mira',
    'lyapunov',
    'chua',
    'double-pendulum',
    'bakers-map'
));

COMMIT;
```

- [ ] **Step 2: Add journal entry**

In `drizzle/meta/_journal.json`, add after the last entry (idx 11):

```json
{
	"idx": 12,
	"version": "7",
	"when": 1779699600007,
	"tag": "0012_add_bakers_map_map_type",
	"breakpoints": true
}
```

- [ ] **Step 3: Update schema test**

In `src/lib/server/db/schema.test.ts`, update the journal test (around line 77):

Change:

```typescript
	test('drizzle journal registers the 0011 tinkerbell migration', () => {
```

To:

```typescript
	test('drizzle journal registers the 0012 bakers-map migration', () => {
```

Change:

```typescript
const entry = journal.entries.find((e) => e.tag === '0011_add_tinkerbell_map_type');
expect(entry).toBeDefined();
expect(entry!.idx).toBe(11);
```

To:

```typescript
const entry = journal.entries.find((e) => e.tag === '0012_add_bakers_map_map_type');
expect(entry).toBeDefined();
expect(entry!.idx).toBe(12);
```

- [ ] **Step 4: Run schema tests**

Run: `bun run vitest run src/lib/server/db/schema.test.ts`
Expected: PASS — all migration constraint tests pass (the test auto-detects the latest constraint-bearing migration).

- [ ] **Step 5: Commit**

```bash
git add drizzle/0012_add_bakers_map_map_type.sql drizzle/meta/_journal.json src/lib/server/db/schema.test.ts
git commit -m "feat: add bakers-map DB migration 0012 (HPA-63)"
```

---

### Task 3: BakersMapRenderer Component

The canvas-based animation engine. Uses `Float64Array` for point data, `requestAnimationFrame` loop with auto-reset at 50 iterations, and signal-counter props for reset/randomize/step controls.

**Files:**

- Create: `src/lib/components/visualizations/BakersMapRenderer.svelte`
- Test: `src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts`

**Interfaces:**

- Consumes: `COLOR_PRIMARY`, `COLOR_MAGENTA`, `VIZ_CONTAINER_HEIGHT` from `$lib/constants`
- Produces: `BakersMapRenderer` Svelte component with props `{ height, containerElement, pointCount, speed, paused, resetSignal, randomizeSignal, stepSignal }`

- [ ] **Step 1: Write the failing renderer tests**

Create `src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts`:

```typescript
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import BakersMapRenderer from './BakersMapRenderer.svelte';

// jsdom doesn't implement canvas getContext — stub it
beforeEach(() => {
	HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		set fillStyle(_v: string) {},
		get fillStyle() {
			return '';
		}
	}) as unknown as CanvasRenderingContext2D);
});

// jsdom doesn't implement RAF
beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('BakersMapRenderer', () => {
	test('mounts without errors', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.querySelector('canvas')).toBeTruthy();
	});

	test('creates the LIVE_RENDER badge', () => {
		const { container } = render(BakersMapRenderer);
		const badge = container.querySelector('.text-primary\\/40');
		// At minimum, the container has overlay text
		expect(container.textContent).toContain('LIVE_RENDER');
	});

	test('cancelAnimationFrame is called on unmount', () => {
		const { unmount } = render(BakersMapRenderer);
		unmount();
		expect(cancelAnimationFrame).toHaveBeenCalled();
	});

	test('displays iteration counter overlay', () => {
		const { container } = render(BakersMapRenderer);
		expect(container.textContent).toContain('ITERATION');
	});

	test('accepts pointCount prop', () => {
		const { component } = render(BakersMapRenderer, { pointCount: 500 });
		// No error thrown means prop was accepted
		expect(component).toBeTruthy();
	});

	test('accepts speed prop', () => {
		const { component } = render(BakersMapRenderer, { speed: 5 });
		expect(component).toBeTruthy();
	});

	test('accepts paused prop', () => {
		const { component } = render(BakersMapRenderer, { paused: true });
		expect(component).toBeTruthy();
	});

	test('does not crash when resetSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { resetSignal: 0 });
		await rerender({ resetSignal: 1 });
		// No crash = pass
	});

	test('does not crash when randomizeSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { randomizeSignal: 0 });
		await rerender({ randomizeSignal: 1 });
	});

	test('does not crash when stepSignal changes', async () => {
		const { rerender } = render(BakersMapRenderer, { stepSignal: 0, paused: true });
		await rerender({ stepSignal: 1 });
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement the renderer**

Create `src/lib/components/visualizations/BakersMapRenderer.svelte`:

```svelte
<!--
  BakersMapRenderer Component
  Animated canvas visualization of the Baker's Map stretch/cut/stack mixing.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { COLOR_PRIMARY, COLOR_MAGENTA } from '$lib/constants';

	interface Props {
		height?: number;
		containerElement?: HTMLDivElement;
		pointCount?: number;
		speed?: number;
		paused?: boolean;
		resetSignal?: number;
		randomizeSignal?: number;
		stepSignal?: number;
	}

	let {
		height = 600,
		containerElement = $bindable(),
		pointCount = $bindable(3000),
		speed = $bindable(1),
		paused = $bindable(false),
		resetSignal = 0,
		randomizeSignal = 0,
		stepSignal = 0
	}: Props = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		containerElement = container;
	});

	const interpCyanMagenta = d3.interpolate(COLOR_PRIMARY, COLOR_MAGENTA);
	const MAX_ITERATIONS = 50;

	let currentX = new Float64Array(0);
	let currentY = new Float64Array(0);
	let initialX = new Float64Array(0);
	let initialY = new Float64Array(0);
	let iterationCount = 0;

	let canvas: HTMLCanvasElement;
	let iterationLabel: HTMLDivElement;
	let rafId: number | null = null;
	let isUnmounted = false;
	let lastLabelUpdate = 0;
	let initialized = false;

	function clampInt(v: number, min: number, max: number): number {
		if (!Number.isFinite(v)) return min;
		return Math.min(max, Math.max(min, Math.round(v)));
	}

	function initDistribution(count: number) {
		currentX = new Float64Array(count);
		currentY = new Float64Array(count);
		initialX = new Float64Array(count);
		initialY = new Float64Array(count);
		for (let i = 0; i < count; i++) {
			const x = Math.random();
			const y = Math.random();
			currentX[i] = x;
			currentY[i] = y;
			initialX[i] = x;
			initialY[i] = y;
		}
		iterationCount = 0;
	}

	function applyStep() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			const x = currentX[i];
			const y = currentY[i];
			const doubled = 2 * x;
			if (doubled < 1) {
				currentX[i] = doubled;
				currentY[i] = y / 2;
			} else {
				currentX[i] = doubled - 1;
				currentY[i] = (y + 1) / 2;
			}
		}
		iterationCount++;
		if (iterationCount >= MAX_ITERATIONS) {
			for (let i = 0; i < count; i++) {
				const x = Math.random();
				const y = Math.random();
				currentX[i] = x;
				currentY[i] = y;
				initialX[i] = x;
				initialY[i] = y;
			}
			iterationCount = 0;
		}
	}

	function doReset() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			currentX[i] = initialX[i];
			currentY[i] = initialY[i];
		}
		iterationCount = 0;
	}

	function doRandomize() {
		const count = currentX.length;
		for (let i = 0; i < count; i++) {
			const x = Math.random();
			const y = Math.random();
			currentX[i] = x;
			currentY[i] = y;
			initialX[i] = x;
			initialY[i] = y;
		}
		iterationCount = 0;
	}

	function renderFrame(timestamp: number) {
		if (isUnmounted) return;

		if (canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				if (!paused) {
					const steps = clampInt(speed, 1, 10);
					for (let s = 0; s < steps; s++) {
						applyStep();
					}
				}

				ctx.clearRect(0, 0, canvas.width, canvas.height);
				const w = canvas.width;
				const h = canvas.height;
				for (let i = 0; i < currentX.length; i++) {
					const px = currentX[i] * w;
					const py = (1 - currentY[i]) * h;
					ctx.fillStyle = interpCyanMagenta(initialY[i]);
					ctx.fillRect(px, py, 1, 1);
				}

				if (timestamp - lastLabelUpdate > 100) {
					if (iterationLabel) {
						iterationLabel.textContent = `ITERATION: ${iterationCount}`;
					}
					lastLabelUpdate = timestamp;
				}
			}
		}

		rafId = requestAnimationFrame(renderFrame);
	}

	function updateCanvasSize() {
		if (!container || !canvas) return;
		const nextWidth = Math.max(0, Math.floor(container.clientWidth));
		const nextHeight = Math.max(0, Math.floor(height - 32));
		if (canvas.width !== nextWidth) canvas.width = nextWidth;
		if (canvas.height !== nextHeight) canvas.height = nextHeight;
	}

	// Signal effects — skip initial run (Svelte $effect fires on mount)
	let prevReset = resetSignal;
	$effect(() => {
		if (resetSignal === prevReset) return;
		prevReset = resetSignal;
		doReset();
	});

	let prevRandomize = randomizeSignal;
	$effect(() => {
		if (randomizeSignal === prevRandomize) return;
		prevRandomize = randomizeSignal;
		doRandomize();
	});

	let prevStep = stepSignal;
	$effect(() => {
		if (stepSignal === prevStep) return;
		prevStep = stepSignal;
		if (paused) applyStep();
	});

	// Reinitialize when pointCount changes (skip initial — onMount handles it)
	$effect(() => {
		void pointCount;
		if (!initialized) return;
		const clamped = clampInt(pointCount, 100, 10000);
		initDistribution(clamped);
	});

	onMount(() => {
		const clampedCount = clampInt(pointCount, 100, 10000);
		initDistribution(clampedCount);
		initialized = true;
		updateCanvasSize();
		const resizeObserver = new ResizeObserver(() => updateCanvasSize());
		if (container) resizeObserver.observe(container);
		rafId = requestAnimationFrame(renderFrame);
		return () => {
			isUnmounted = true;
			if (rafId !== null) cancelAnimationFrame(rafId);
			resizeObserver.disconnect();
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative p-4"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} class="w-full h-full block"></canvas>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // CANVAS_2D
	</div>
	<div
		bind:this={iterationLabel}
		class="absolute top-4 left-4 text-xs font-['Rajdhani'] text-primary/60 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		ITERATION: 0
	</div>
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts`
Expected: PASS — all 10 tests pass.

- [ ] **Step 5: Run typecheck**

Run: `bun run check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/visualizations/BakersMapRenderer.svelte src/lib/components/visualizations/BakersMapRenderer.svelte.test.ts
git commit -m "feat: add BakersMapRenderer canvas animation component (HPA-63)"
```

---

### Task 4: Route Page

Create the main `/bakers-map` route page with `VisualizationShell`, page-owned controls, and the renderer.

**Files:**

- Create: `src/routes/bakers-map/+page.svelte`

**Interfaces:**

- Consumes: `VisualizationShell` from `$lib/components/ui/VisualizationShell.svelte`, `BakersMapRenderer` from Task 3, `createStabilityReporter` from `$lib/stability-reporter`, `VIZ_CONTAINER_HEIGHT` from `$lib/constants`, `BakersMapParameters` from `$lib/types`

- [ ] **Step 1: Create the route page**

Create `src/routes/bakers-map/+page.svelte`:

```svelte
<script lang="ts">
	import VisualizationShell from '$lib/components/ui/VisualizationShell.svelte';
	import BakersMapRenderer from '$lib/components/visualizations/BakersMapRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { createStabilityReporter } from '$lib/stability-reporter';
	import type { BakersMapParameters, ChaosMapParameters } from '$lib/types';

	let { data } = $props();

	let pointCount = $state(3000);
	let speed = $state(1);
	let paused = $state(false);
	let resetSignal = $state(0);
	let randomizeSignal = $state(0);
	let stepSignal = $state(0);

	function clampInt(v: number, min: number, max: number): number {
		if (!Number.isFinite(v)) return min;
		return Math.min(max, Math.max(min, Math.round(v)));
	}

	const stability = createStabilityReporter({
		mapType: 'bakers-map',
		getParams: () => buildParameters(),
		reactive: true
	});

	$effect(() => {
		void pointCount;
		void speed;
		stability.triggerReactive();
		return () => stability.cleanupReactive();
	});

	function buildParameters(): BakersMapParameters {
		return { type: 'bakers-map', pointCount, speed };
	}

	function onExtraParametersLoaded(p: ChaosMapParameters) {
		if (p.type !== 'bakers-map') return;
		pointCount = clampInt(p.pointCount, 100, 10000);
		speed = clampInt(p.speed, 1, 10);
	}
</script>

<VisualizationShell
	mapType="bakers-map"
	title="BAKERS_MAP"
	paramDefs={[]}
	paramColumns={1}
	{buildParameters}
	{onExtraParametersLoaded}
	stabilityReporter={stability.stabilityReporter}
	formula={['x(n+1) = 2x(n) mod 1', 'y(n+1) = (y(n) + floor(2x(n))) / 2']}
	formulaColumns={2}
	description={{
		heading: 'DATA_LOG: BAKERS_MAP',
		body: 'The Baker\u2019s Map is the simplest model of chaotic mixing. Each step stretches the unit square horizontally by a factor of two, cuts it at the midpoint, and stacks the right half on top of the left. The map is measure-preserving, so a uniform distribution stays uniform forever \u2014 but points colored by their initial height interleave into ever-finer horizontal bands, making the stretch/cut/stack mechanism visible. This is the same kneading action that gives chaotic systems their mixing property: after enough folds, any two nearby points end up far apart.'
	}}
	isAuthenticated={!!data?.session}
>
	{#snippet extraControls()}
		<div class="space-y-6">
			<!-- Animation parameters -->
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3
						class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2"
					>
						<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
						PARAMETERS
					</h3>
				</div>

				<div class="space-y-4">
					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label
								for="pointCount"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Count</label
							>
							<span data-testid="value-pointCount" class="font-mono text-accent">{pointCount}</span>
						</div>
						<input
							id="pointCount"
							data-testid="slider-pointCount"
							type="range"
							bind:value={pointCount}
							min="100"
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>

					<div class="space-y-2">
						<div class="flex justify-between items-end">
							<label for="speed" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Speed</label
							>
							<span data-testid="value-speed" class="font-mono text-accent">{speed}</span>
						</div>
						<input
							id="speed"
							data-testid="slider-speed"
							type="range"
							bind:value={speed}
							min="1"
							max="10"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
			</div>

			<!-- Controls -->
			<div class="space-y-4">
				<h3 class="text-base font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
					<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
					CONTROLS
				</h3>
				<div class="flex flex-wrap gap-3">
					<button
						data-testid="btn-pause"
						onclick={() => (paused = !paused)}
						class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
					>
						{paused ? '▶ Resume' : '❚❚ Pause'}
					</button>
					<button
						data-testid="btn-step"
						onclick={() => stepSignal++}
						disabled={!paused}
						class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
					>
						→ Step
					</button>
					<button
						data-testid="btn-reset"
						onclick={() => resetSignal++}
						class="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
					>
						↺ Reset
					</button>
					<button
						data-testid="btn-randomize"
						onclick={() => randomizeSignal++}
						class="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all uppercase tracking-widest text-xs font-bold"
					>
						🎲 Randomize
					</button>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet renderer({ container })}
		<!-- prettier-ignore -->
		<BakersMapRenderer
			height={VIZ_CONTAINER_HEIGHT}
			bind:containerElement={container.el}
			bind:pointCount
			bind:speed
			bind:paused
			{resetSignal}
			{randomizeSignal}
			{stepSignal}
		/>
	{/snippet}
</VisualizationShell>
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `bun run test`
Expected: PASS — no regressions

- [ ] **Step 4: Commit**

```bash
git add src/routes/bakers-map/+page.svelte
git commit -m "feat: add /bakers-map route page (HPA-63)"
```

---

### Task 5: Compare Route

Create the side-by-side comparison route. Every map's `VisualizationShell` renders a Compare button linking to `/{mapType}/compare`. Without this route, the Compare button 404s.

**Files:**

- Create: `src/routes/bakers-map/compare/+page.svelte`

**Interfaces:**

- Consumes: `ComparisonLayout` from `$lib/components/comparison/ComparisonLayout.svelte`, `ComparisonParameterPanel` from `$lib/components/comparison/ComparisonParameterPanel.svelte`, `BakersMapRenderer` from Task 3, `decodeComparisonState`/`getDefaultParameters`/`encodeComparisonState` from `$lib/comparison-url-state`, `getStableRanges` from `$lib/chaos-validation`, `BakersMapParameters` from `$lib/types`

- [ ] **Step 1: Create the compare route page**

Create `src/routes/bakers-map/compare/+page.svelte`:

```svelte
<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import BakersMapRenderer from '$lib/components/visualizations/BakersMapRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { BakersMapParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'bakers-map');
	const defaultParams = getDefaultParameters('bakers-map') as BakersMapParameters;
	const ranges = getStableRanges('bakers-map')!;

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: BakersMapParameters | null): BakersMapParameters => {
		const source = params ?? defaultParams;
		return {
			type: 'bakers-map',
			pointCount: clampValue(
				source.pointCount,
				ranges.pointCount.min,
				ranges.pointCount.max,
				defaultParams.pointCount
			),
			speed: clampValue(source.speed, ranges.speed.min, ranges.speed.max, defaultParams.speed)
		};
	};

	const leftInitial = clampParams(initialState?.left as BakersMapParameters | null);
	const rightInitial = clampParams(initialState?.right as BakersMapParameters | null);

	let leftPointCount = $state(leftInitial.pointCount);
	let leftSpeed = $state(leftInitial.speed);
	let rightPointCount = $state(rightInitial.pointCount);
	let rightSpeed = $state(rightInitial.speed);

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftPointCount;
		void leftSpeed;
		void rightPointCount;
		void rightSpeed;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/bakers-map/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): BakersMapParameters {
		return { type: 'bakers-map', pointCount: leftPointCount, speed: leftSpeed };
	}
	function getRightParams(): BakersMapParameters {
		return { type: 'bakers-map', pointCount: rightPointCount, speed: rightSpeed };
	}

	function handleLeftParamsChange(p: BakersMapParameters) {
		leftPointCount = p.pointCount;
		leftSpeed = p.speed;
	}
	function handleRightParamsChange(p: BakersMapParameters) {
		rightPointCount = p.pointCount;
		rightSpeed = p.speed;
	}
</script>

<ComparisonLayout
	mapType="bakers-map"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as BakersMapParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as BakersMapParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-pointCount"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Count</label
							>
							<span class="font-mono text-accent text-sm">{leftPointCount}</span>
						</div>
						<input
							id="left-pointCount"
							type="range"
							value={leftPointCount}
							oninput={(e) =>
								(leftPointCount = Number((e.currentTarget as HTMLInputElement).value))}
							min="100"
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-speed"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Speed</label
							>
							<span class="font-mono text-accent text-sm">{leftSpeed}</span>
						</div>
						<input
							id="left-speed"
							type="range"
							value={leftSpeed}
							oninput={(e) => (leftSpeed = Number((e.currentTarget as HTMLInputElement).value))}
							min="1"
							max="10"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = 2x(n) mod 1</p>
					<p>y(n+1) = (y(n) + floor(2x(n))) / 2</p>
				{/snippet}
			</ComparisonParameterPanel>
			<BakersMapRenderer bind:pointCount={leftPointCount} bind:speed={leftSpeed} height={400} />
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-pointCount"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold"
								>Point Count</label
							>
							<span class="font-mono text-accent text-sm">{rightPointCount}</span>
						</div>
						<input
							id="right-pointCount"
							type="range"
							value={rightPointCount}
							oninput={(e) =>
								(rightPointCount = Number((e.currentTarget as HTMLInputElement).value))}
							min="100"
							max="10000"
							step="100"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-speed"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Speed</label
							>
							<span class="font-mono text-accent text-sm">{rightSpeed}</span>
						</div>
						<input
							id="right-speed"
							type="range"
							value={rightSpeed}
							oninput={(e) => (rightSpeed = Number((e.currentTarget as HTMLInputElement).value))}
							min="1"
							max="10"
							step="1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>x(n+1) = 2x(n) mod 1</p>
					<p>y(n+1) = (y(n) + floor(2x(n))) / 2</p>
				{/snippet}
			</ComparisonParameterPanel>
			<BakersMapRenderer bind:pointCount={rightPointCount} bind:speed={rightSpeed} height={400} />
		</div>
	{/snippet}
</ComparisonLayout>
```

- [ ] **Step 2: Run typecheck**

Run: `bun run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/bakers-map/compare/+page.svelte
git commit -m "feat: add /bakers-map/compare route (HPA-63)"
```

---

### Task 6: Homepage Card

Add the Baker's Map card to the homepage grid.

**Files:**

- Modify: `src/routes/+page.svelte` (the `visualizations` array, after the Double Pendulum entry around line 108)

**Interfaces:**

- Consumes: nothing new

- [ ] **Step 1: Add the card**

In `src/routes/+page.svelte`, add after the Double Pendulum entry in the `visualizations` array (after line 108, before the closing `];`):

```javascript
		{
			name: "Baker's Map",
			description: 'A stretch-cut-stack map that demonstrates chaotic mixing in phase space',
			url: '/bakers-map',
			color: 'from-yellow-500 to-amber-600'
		}
```

- [ ] **Step 2: Run lint**

Run: `bun run lint`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add Baker's Map homepage card (HPA-63)"
```

---

### Task 7: Final Verification

Run all checks to confirm the complete module works end-to-end.

- [ ] **Step 1: Run typecheck**

Run: `bun run check`
Expected: PASS — zero errors

- [ ] **Step 2: Run full test suite**

Run: `bun run test`
Expected: PASS — all existing tests + new bakers-map tests pass

- [ ] **Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

- [ ] **Step 4: Manual dev server smoke test**

Run: `bun run dev`

Open `http://localhost:5173/bakers-map` and verify:

- Page loads without console errors
- Canvas shows colored points in unit square
- Animation runs (points mix into color bands over iterations)
- Iteration counter increments
- Pause button stops animation
- Step button advances one iteration (when paused)
- Reset button restores initial distribution
- Randomize button generates new distribution
- Point Count slider changes number of points
- Speed slider changes animation rate
- Compare button navigates to `/bakers-map/compare` (not 404)
- Homepage card links to `/bakers-map`

- [ ] **Step 5: Final commit if any fixes were needed**

If any issues were found and fixed during the smoke test, commit those fixes:

```bash
git add -A
git commit -m "fix: address smoke test issues in bakers-map module (HPA-63)"
```
