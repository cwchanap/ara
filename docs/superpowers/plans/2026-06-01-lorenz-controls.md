# Lorenz Attractor Control Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full interactive control suite to the Lorenz attractor module — initial conditions + ghost orbit, trail length (comet/cumulative), playback (play/pause/step/reset/speed), solver/dt controls, color modes, view/projection, presets, and a live Lyapunov chaos indicator — backed by an animated-head renderer and full save/share reproducibility.

**Architecture:** Pure math/util modules in `src/lib/lorenz/` (integration, colors, Lyapunov, presets, defaults) feed a rewritten `LorenzRenderer.svelte` that precomputes the trajectory on math changes and animates a `head` index across it. Small focused control components compose onto `src/routes/lorenz/+page.svelte`. The persisted `LorenzParameters` type is extended with optional fields; the shared `validateParameters` is taught Lorenz's typed optional fields so save/share/load round-trip while old σ/ρ/β-only configs still load.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), Three.js (`Line2`/`LineGeometry`/`LineMaterial`), Bun test (`*.test.ts`), Vitest + Testing Library (`*.vitest.ts`), Playwright (`e2e/*.spec.ts`).

**Spec:** `docs/superpowers/specs/2026-06-01-lorenz-controls-design.md`

---

## Conventions for every task

- Run a single bun test file: `bun test src/lib/lorenz/<file>.test.ts`
- Run all bun unit tests: `bun test`
- Run a single vitest file: `bunx vitest run src/lib/components/visualizations/lorenz/<file>.vitest.ts`
- Type-check: `bun run check`
- Lint/format before commit: `bun run lint` then `bun run format`
- Commit messages follow the repo's conventional style (e.g. `feat(lorenz): …`, `test(lorenz): …`).

## Shared identifiers (defined once, reused everywhere)

These names are introduced in Tasks 1–6 and referenced by every later task. Keep them exact.

- `Solver = 'euler' | 'rk2' | 'rk4'` (exported from `$lib/types` as `LorenzSolver`)
- `LorenzColorMode = 'time' | 'speed' | 'zheight' | 'divergence' | 'single'`
- `LorenzTrailStyle = 'comet' | 'cumulative'`
- `LorenzViewMode = '3d' | 'xy' | 'xz' | 'yz'`
- `LorenzPoint = { x: number; y: number; z: number }`
- `LorenzIntegrationParams = { sigma; rho; beta; x0; y0; z0; solver; dt; steps }` (all `number` except `solver: LorenzSolver`)
- `LorenzResult = { positions: Float32Array; speeds: Float32Array; diverged: boolean }`
- `integrate(p: LorenzIntegrationParams): LorenzResult`
- `computeColors(result: LorenzResult, mode: LorenzColorMode, opts?: { ghost?: LorenzResult }): Float32Array`
- `estimateLargestLyapunov(p: LorenzIntegrationParams): LyapunovEstimate` (type reused from `$lib/chua`)
- `LORENZ_PRESETS`, `matchPreset(p): string`
- `ResolvedLorenzParameters`, `LORENZ_DEFAULTS`, `withLorenzDefaults(p)`
- `COMET_WINDOW = 2000` (constant added to `src/lib/constants.ts`)

---

# Phase 1 — Pure math/util modules

## Task 1: Integrators (`src/lib/lorenz/integrators.ts`)

**Files:**

- Create: `src/lib/lorenz/integrators.ts`
- Test: `src/lib/lorenz/integrators.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/lorenz/integrators.test.ts
import { describe, expect, test } from 'bun:test';
import { lorenzDeriv, step, integrate } from './integrators';
import type { LorenzIntegrationParams } from './integrators';

const base: LorenzIntegrationParams = {
	sigma: 10,
	rho: 28,
	beta: 8 / 3,
	x0: 0.1,
	y0: 0,
	z0: 0,
	solver: 'rk4',
	dt: 0.005,
	steps: 500
};

describe('lorenzDeriv', () => {
	test('is zero at the origin', () => {
		const d = lorenzDeriv(0, 0, 0, 10, 28, 8 / 3);
		expect(d.dx).toBeCloseTo(0, 12);
		expect(d.dy).toBeCloseTo(0, 12);
		expect(d.dz).toBeCloseTo(0, 12);
	});

	test('matches the Lorenz equations at a sample point', () => {
		const d = lorenzDeriv(1, 2, 3, 10, 28, 8 / 3);
		expect(d.dx).toBeCloseTo(10 * (2 - 1), 12); // 10
		expect(d.dy).toBeCloseTo(1 * (28 - 3) - 2, 12); // 23
		expect(d.dz).toBeCloseTo(1 * 2 - (8 / 3) * 3, 12); // 2 - 8 = -6
	});
});

describe('step', () => {
	const p: LorenzIntegrationParams = { ...base, solver: 'euler' };

	test('euler step equals state + dt*derivative', () => {
		const next = step({ x: 1, y: 2, z: 3 }, p);
		const d = lorenzDeriv(1, 2, 3, p.sigma, p.rho, p.beta);
		expect(next.x).toBeCloseTo(1 + p.dt * d.dx, 12);
		expect(next.y).toBeCloseTo(2 + p.dt * d.dy, 12);
		expect(next.z).toBeCloseTo(3 + p.dt * d.dz, 12);
	});

	test('the origin is a fixed point for every solver', () => {
		for (const solver of ['euler', 'rk2', 'rk4'] as const) {
			const next = step({ x: 0, y: 0, z: 0 }, { ...base, solver });
			expect(next.x).toBeCloseTo(0, 12);
			expect(next.y).toBeCloseTo(0, 12);
			expect(next.z).toBeCloseTo(0, 12);
		}
	});

	test('rk4 differs from euler at a non-trivial point', () => {
		const e = step({ x: 1, y: 2, z: 3 }, { ...base, solver: 'euler' });
		const r = step({ x: 1, y: 2, z: 3 }, { ...base, solver: 'rk4' });
		expect(Math.abs(r.x - e.x) + Math.abs(r.y - e.y) + Math.abs(r.z - e.z)).toBeGreaterThan(0);
	});
});

describe('integrate', () => {
	test('returns positions of length steps*3 and speeds of length steps', () => {
		const result = integrate(base);
		expect(result.diverged).toBe(false);
		expect(result.positions.length).toBe(base.steps * 3);
		expect(result.speeds.length).toBe(base.steps);
	});

	test('speeds[0] equals the derivative magnitude at the first integrated point', () => {
		const result = integrate({ ...base, steps: 1 });
		// First integrated point:
		const first = step({ x: base.x0, y: base.y0, z: base.z0 }, { ...base, steps: 1 });
		const d = lorenzDeriv(first.x, first.y, first.z, base.sigma, base.rho, base.beta);
		const mag = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
		expect(result.speeds[0]).toBeCloseTo(mag, 6);
	});

	test('flags diverged on a blow-up configuration', () => {
		const result = integrate({ ...base, solver: 'euler', dt: 10, steps: 200 });
		expect(result.diverged).toBe(true);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/lorenz/integrators.test.ts`
Expected: FAIL — module `./integrators` not found / exports undefined.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lorenz/integrators.ts
import type { LorenzSolver } from '$lib/types';

export type Solver = LorenzSolver;

export interface LorenzPoint {
	x: number;
	y: number;
	z: number;
}

export interface LorenzIntegrationParams {
	sigma: number;
	rho: number;
	beta: number;
	x0: number;
	y0: number;
	z0: number;
	solver: Solver;
	dt: number;
	steps: number;
}

export interface LorenzResult {
	/** Flat [x, y, z, …], length = steps * 3, ready for LineGeometry.setPositions. */
	positions: Float32Array;
	/** |derivative| at each integrated point, length = steps. */
	speeds: Float32Array;
	/** True if integration stopped early because a value became non-finite. */
	diverged: boolean;
}

interface Derivatives {
	dx: number;
	dy: number;
	dz: number;
}

export function lorenzDeriv(
	x: number,
	y: number,
	z: number,
	sigma: number,
	rho: number,
	beta: number
): Derivatives {
	return {
		dx: sigma * (y - x),
		dy: x * (rho - z) - y,
		dz: x * y - beta * z
	};
}

/** Advance one integration step using the selected solver. */
export function step(state: LorenzPoint, p: LorenzIntegrationParams): LorenzPoint {
	const { sigma, rho, beta, dt, solver } = p;
	const { x, y, z } = state;
	const k1 = lorenzDeriv(x, y, z, sigma, rho, beta);

	if (solver === 'euler') {
		return { x: x + dt * k1.dx, y: y + dt * k1.dy, z: z + dt * k1.dz };
	}

	if (solver === 'rk2') {
		// Midpoint method.
		const k2 = lorenzDeriv(
			x + (dt / 2) * k1.dx,
			y + (dt / 2) * k1.dy,
			z + (dt / 2) * k1.dz,
			sigma,
			rho,
			beta
		);
		return { x: x + dt * k2.dx, y: y + dt * k2.dy, z: z + dt * k2.dz };
	}

	// rk4 (classic 4th-order Runge–Kutta).
	const k2 = lorenzDeriv(
		x + (dt / 2) * k1.dx,
		y + (dt / 2) * k1.dy,
		z + (dt / 2) * k1.dz,
		sigma,
		rho,
		beta
	);
	const k3 = lorenzDeriv(
		x + (dt / 2) * k2.dx,
		y + (dt / 2) * k2.dy,
		z + (dt / 2) * k2.dz,
		sigma,
		rho,
		beta
	);
	const k4 = lorenzDeriv(x + dt * k3.dx, y + dt * k3.dy, z + dt * k3.dz, sigma, rho, beta);
	return {
		x: x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
		y: y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
		z: z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz)
	};
}

/**
 * Integrate the Lorenz system into flat typed arrays.
 * Stops early and sets `diverged = true` on any non-finite component, leaving
 * the remainder of the buffers as zeros so geometry never receives NaN/Infinity.
 */
export function integrate(p: LorenzIntegrationParams): LorenzResult {
	const steps = Math.max(0, Math.floor(p.steps));
	const positions = new Float32Array(steps * 3);
	const speeds = new Float32Array(steps);

	let x = p.x0;
	let y = p.y0;
	let z = p.z0;

	for (let i = 0; i < steps; i++) {
		const next = step({ x, y, z }, p);
		if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.z)) {
			return { positions, speeds, diverged: true };
		}
		x = next.x;
		y = next.y;
		z = next.z;
		positions[i * 3] = x;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z;
		const d = lorenzDeriv(x, y, z, p.sigma, p.rho, p.beta);
		speeds[i] = Math.sqrt(d.dx * d.dx + d.dy * d.dy + d.dz * d.dz);
	}

	return { positions, speeds, diverged: false };
}
```

> NOTE: This task imports `LorenzSolver` from `$lib/types`. That type is added in Task 6. If implementing strictly in order, temporarily define `export type Solver = 'euler' | 'rk2' | 'rk4';` locally and switch the import to `$lib/types` in Task 6. The test does not depend on the import source.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/lorenz/integrators.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Type-check and commit**

```bash
bun run check
bun run lint && bun run format
git add src/lib/lorenz/integrators.ts src/lib/lorenz/integrators.test.ts
git commit -m "feat(lorenz): add selectable-solver integrator module"
```

---

## Task 2: Defaults & resolver (`src/lib/lorenz/defaults.ts`)

**Files:**

- Create: `src/lib/lorenz/defaults.ts`
- Test: `src/lib/lorenz/defaults.test.ts`

> Depends on the extended `LorenzParameters` type (Task 6). Implement Task 6's type change first if running strictly in order, OR define the type import now and let Task 6 satisfy it. The plan lists this in Phase 1 for cohesion; the test only needs the runtime behavior.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/lorenz/defaults.test.ts
import { describe, expect, test } from 'bun:test';
import { LORENZ_DEFAULTS, withLorenzDefaults } from './defaults';

describe('withLorenzDefaults', () => {
	test('fills every optional field when only sigma/rho/beta are given', () => {
		const resolved = withLorenzDefaults({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 });
		expect(resolved.solver).toBe(LORENZ_DEFAULTS.solver);
		expect(resolved.dt).toBe(LORENZ_DEFAULTS.dt);
		expect(resolved.trailLength).toBe(LORENZ_DEFAULTS.trailLength);
		expect(resolved.trailStyle).toBe(LORENZ_DEFAULTS.trailStyle);
		expect(resolved.colorMode).toBe(LORENZ_DEFAULTS.colorMode);
		expect(resolved.viewMode).toBe(LORENZ_DEFAULTS.viewMode);
		expect(resolved.showGhost).toBe(LORENZ_DEFAULTS.showGhost);
		expect(resolved.epsilon).toBe(LORENZ_DEFAULTS.epsilon);
		expect(resolved.x0).toBe(LORENZ_DEFAULTS.x0);
	});

	test('preserves provided overrides', () => {
		const resolved = withLorenzDefaults({
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3,
			solver: 'euler',
			dt: 0.01,
			showGhost: true,
			colorMode: 'zheight'
		});
		expect(resolved.solver).toBe('euler');
		expect(resolved.dt).toBe(0.01);
		expect(resolved.showGhost).toBe(true);
		expect(resolved.colorMode).toBe('zheight');
		expect(resolved.sigma).toBe(10);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/lorenz/defaults.test.ts`
Expected: FAIL — `./defaults` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lorenz/defaults.ts
import type {
	LorenzParameters,
	LorenzSolver,
	LorenzColorMode,
	LorenzTrailStyle,
	LorenzViewMode
} from '$lib/types';

export interface ResolvedLorenzParameters {
	type: 'lorenz';
	sigma: number;
	rho: number;
	beta: number;
	x0: number;
	y0: number;
	z0: number;
	epsilon: number;
	showGhost: boolean;
	solver: LorenzSolver;
	dt: number;
	stepsPerFrame: number;
	speed: number;
	colorMode: LorenzColorMode;
	trailLength: number;
	trailStyle: LorenzTrailStyle;
	viewMode: LorenzViewMode;
	autoRotate: boolean;
	rotationSpeed: number;
	zoom: number;
}

/** Defaults for every optional field. σ/ρ/β have no defaults (always required). */
export const LORENZ_DEFAULTS: Omit<ResolvedLorenzParameters, 'type' | 'sigma' | 'rho' | 'beta'> = {
	x0: 0.1,
	y0: 0,
	z0: 0,
	epsilon: 0.001,
	showGhost: false,
	solver: 'rk4',
	dt: 0.005,
	stepsPerFrame: 5,
	speed: 1,
	colorMode: 'time',
	trailLength: 15000,
	trailStyle: 'comet',
	viewMode: '3d',
	autoRotate: true,
	rotationSpeed: 0.5,
	zoom: 1
};

/** Resolve a (possibly partial) persisted LorenzParameters into a fully-populated object. */
export function withLorenzDefaults(p: LorenzParameters): ResolvedLorenzParameters {
	return {
		type: 'lorenz',
		sigma: p.sigma,
		rho: p.rho,
		beta: p.beta,
		x0: p.x0 ?? LORENZ_DEFAULTS.x0,
		y0: p.y0 ?? LORENZ_DEFAULTS.y0,
		z0: p.z0 ?? LORENZ_DEFAULTS.z0,
		epsilon: p.epsilon ?? LORENZ_DEFAULTS.epsilon,
		showGhost: p.showGhost ?? LORENZ_DEFAULTS.showGhost,
		solver: p.solver ?? LORENZ_DEFAULTS.solver,
		dt: p.dt ?? LORENZ_DEFAULTS.dt,
		stepsPerFrame: p.stepsPerFrame ?? LORENZ_DEFAULTS.stepsPerFrame,
		speed: p.speed ?? LORENZ_DEFAULTS.speed,
		colorMode: p.colorMode ?? LORENZ_DEFAULTS.colorMode,
		trailLength: p.trailLength ?? LORENZ_DEFAULTS.trailLength,
		trailStyle: p.trailStyle ?? LORENZ_DEFAULTS.trailStyle,
		viewMode: p.viewMode ?? LORENZ_DEFAULTS.viewMode,
		autoRotate: p.autoRotate ?? LORENZ_DEFAULTS.autoRotate,
		rotationSpeed: p.rotationSpeed ?? LORENZ_DEFAULTS.rotationSpeed,
		zoom: p.zoom ?? LORENZ_DEFAULTS.zoom
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/lorenz/defaults.test.ts`
Expected: PASS. (Type-check will fail until Task 6 adds the type fields — that is expected; do `bun run check` after Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/lorenz/defaults.ts src/lib/lorenz/defaults.test.ts
git commit -m "feat(lorenz): add defaults and parameter resolver"
```

---

## Task 3: Presets (`src/lib/lorenz/presets.ts`)

**Files:**

- Create: `src/lib/lorenz/presets.ts`
- Test: `src/lib/lorenz/presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/lorenz/presets.test.ts
import { describe, expect, test } from 'bun:test';
import { LORENZ_PRESETS, matchPreset } from './presets';

describe('LORENZ_PRESETS', () => {
	test('classic preset is the canonical Lorenz parameters', () => {
		const classic = LORENZ_PRESETS.find((p) => p.id === 'classic');
		expect(classic).toBeDefined();
		expect(classic!.sigma).toBe(10);
		expect(classic!.rho).toBe(28);
		expect(classic!.beta).toBeCloseTo(8 / 3, 12);
	});

	test('every preset is within the documented ρ slider range [0, 100]', () => {
		for (const p of LORENZ_PRESETS) {
			expect(p.rho).toBeGreaterThanOrEqual(0);
			expect(p.rho).toBeLessThanOrEqual(100);
			expect(p.sigma).toBeGreaterThanOrEqual(0);
			expect(p.sigma).toBeLessThanOrEqual(50);
			expect(p.beta).toBeGreaterThanOrEqual(0);
			expect(p.beta).toBeLessThanOrEqual(10);
		}
	});
});

describe('matchPreset', () => {
	test('matches an exact preset by id', () => {
		expect(matchPreset({ sigma: 10, rho: 28, beta: 8 / 3 })).toBe('classic');
		expect(matchPreset({ sigma: 10, rho: 40, beta: 8 / 3 })).toBe('chaotic');
	});

	test('returns "custom" when no preset matches', () => {
		expect(matchPreset({ sigma: 3, rho: 7, beta: 1 })).toBe('custom');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/lorenz/presets.test.ts`
Expected: FAIL — `./presets` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lorenz/presets.ts
export interface LorenzPreset {
	id: string;
	label: string;
	sigma: number;
	rho: number;
	beta: number;
}

export const LORENZ_PRESETS: LorenzPreset[] = [
	{ id: 'classic', label: 'Classic', sigma: 10, rho: 28, beta: 8 / 3 },
	{ id: 'stable', label: 'Stable', sigma: 10, rho: 10, beta: 8 / 3 },
	{ id: 'periodic', label: 'Near Trans.', sigma: 10, rho: 24.74, beta: 8 / 3 },
	{ id: 'chaotic', label: 'High Energy', sigma: 10, rho: 40, beta: 8 / 3 },
	{ id: 'wild', label: 'Wild', sigma: 14, rho: 99.96, beta: 8 / 3 }
];

const EPS = 1e-6;

/** Return the id of the preset matching the given σ/ρ/β, or 'custom' if none. */
export function matchPreset(p: { sigma: number; rho: number; beta: number }): string {
	const found = LORENZ_PRESETS.find(
		(preset) =>
			Math.abs(preset.sigma - p.sigma) < EPS &&
			Math.abs(preset.rho - p.rho) < EPS &&
			Math.abs(preset.beta - p.beta) < EPS
	);
	return found ? found.id : 'custom';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/lorenz/presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/lorenz/presets.ts src/lib/lorenz/presets.test.ts
git commit -m "feat(lorenz): add parameter presets"
```

---

## Task 4: Color modes (`src/lib/lorenz/colors.ts`)

**Files:**

- Create: `src/lib/lorenz/colors.ts`
- Test: `src/lib/lorenz/colors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/lorenz/colors.test.ts
import { describe, expect, test } from 'bun:test';
import { computeColors } from './colors';
import type { LorenzResult } from './integrators';

function makeResult(points: [number, number, number][]): LorenzResult {
	const positions = new Float32Array(points.length * 3);
	const speeds = new Float32Array(points.length);
	points.forEach((pt, i) => {
		positions[i * 3] = pt[0];
		positions[i * 3 + 1] = pt[1];
		positions[i * 3 + 2] = pt[2];
		speeds[i] = i; // increasing speed
	});
	return { positions, speeds, diverged: false };
}

const result = makeResult([
	[0, 0, 0],
	[1, 1, 5],
	[2, 2, 10]
]);

describe('computeColors', () => {
	test('returns RGB triples in [0,1] of length points*3', () => {
		const colors = computeColors(result, 'time');
		expect(colors.length).toBe(9);
		for (const c of colors) {
			expect(c).toBeGreaterThanOrEqual(0);
			expect(c).toBeLessThanOrEqual(1);
		}
	});

	test('single mode is a constant neon-cyan across all vertices', () => {
		const colors = computeColors(result, 'single');
		expect(colors[0]).toBeCloseTo(colors[3], 6);
		expect(colors[1]).toBeCloseTo(colors[4], 6);
		expect(colors[2]).toBeCloseTo(colors[5], 6);
		// cyan #00f3ff => r≈0, g≈0.953, b≈1
		expect(colors[0]).toBeCloseTo(0, 2);
		expect(colors[2]).toBeCloseTo(1, 2);
	});

	test('time mode goes from cyan at the start to magenta at the end', () => {
		const colors = computeColors(result, 'time');
		const lastIdx = (result.speeds.length - 1) * 3;
		expect(colors[0]).toBeLessThan(colors[lastIdx]); // red rises toward magenta
	});

	test('divergence falls back to a single color when no ghost is provided', () => {
		const colors = computeColors(result, 'divergence');
		expect(colors[0]).toBeCloseTo(colors[3], 6);
	});

	test('divergence uses ghost separation when a ghost is provided', () => {
		const ghost = makeResult([
			[0, 0, 0],
			[1.5, 1, 5],
			[5, 2, 10]
		]);
		const colors = computeColors(result, 'divergence', { ghost });
		// Larger separation at the last point => different color than the first.
		expect(colors[0]).not.toBeCloseTo(colors[6], 3);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/lorenz/colors.test.ts`
Expected: FAIL — `./colors` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lorenz/colors.ts
import type { LorenzResult } from './integrators';
import type { LorenzColorMode } from '$lib/types';

// Neon palette (matches existing Lorenz gradient): cyan -> magenta.
const CYAN = { r: 0x00 / 255, g: 0xf3 / 255, b: 0xff / 255 };
const MAGENTA = { r: 0xbc / 255, g: 0x13 / 255, b: 0xfe / 255 };

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

function writeGradient(colors: Float32Array, i: number, t: number): void {
	const c = clamp01(t);
	colors[i * 3] = lerp(CYAN.r, MAGENTA.r, c);
	colors[i * 3 + 1] = lerp(CYAN.g, MAGENTA.g, c);
	colors[i * 3 + 2] = lerp(CYAN.b, MAGENTA.b, c);
}

function writeSingle(colors: Float32Array, i: number): void {
	colors[i * 3] = CYAN.r;
	colors[i * 3 + 1] = CYAN.g;
	colors[i * 3 + 2] = CYAN.b;
}

/**
 * Per-vertex RGB color buffer for the given mode. Length = points * 3.
 * Divergence mode requires `opts.ghost`; without it, falls back to single color.
 */
export function computeColors(
	result: LorenzResult,
	mode: LorenzColorMode,
	opts: { ghost?: LorenzResult } = {}
): Float32Array {
	const n = result.speeds.length;
	const colors = new Float32Array(n * 3);
	if (n === 0) return colors;

	if (mode === 'single') {
		for (let i = 0; i < n; i++) writeSingle(colors, i);
		return colors;
	}

	if (mode === 'time') {
		for (let i = 0; i < n; i++) writeGradient(colors, i, i / (n - 1 || 1));
		return colors;
	}

	if (mode === 'speed') {
		let max = 0;
		for (let i = 0; i < n; i++) if (result.speeds[i] > max) max = result.speeds[i];
		for (let i = 0; i < n; i++) writeGradient(colors, i, max > 0 ? result.speeds[i] / max : 0);
		return colors;
	}

	if (mode === 'zheight') {
		let min = Infinity;
		let max = -Infinity;
		for (let i = 0; i < n; i++) {
			const z = result.positions[i * 3 + 2];
			if (z < min) min = z;
			if (z > max) max = z;
		}
		const range = max - min || 1;
		for (let i = 0; i < n; i++) {
			writeGradient(colors, i, (result.positions[i * 3 + 2] - min) / range);
		}
		return colors;
	}

	// divergence
	const ghost = opts.ghost;
	if (!ghost) {
		for (let i = 0; i < n; i++) writeSingle(colors, i);
		return colors;
	}
	const m = Math.min(n, ghost.speeds.length);
	const dist = new Float32Array(n);
	let max = 0;
	for (let i = 0; i < m; i++) {
		const dx = result.positions[i * 3] - ghost.positions[i * 3];
		const dy = result.positions[i * 3 + 1] - ghost.positions[i * 3 + 1];
		const dz = result.positions[i * 3 + 2] - ghost.positions[i * 3 + 2];
		const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
		dist[i] = d;
		if (d > max) max = d;
	}
	for (let i = 0; i < n; i++) writeGradient(colors, i, max > 0 ? dist[i] / max : 0);
	return colors;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/lorenz/colors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/lorenz/colors.ts src/lib/lorenz/colors.test.ts
git commit -m "feat(lorenz): add per-vertex color-mode computation"
```

---

## Task 5: Lyapunov estimate (`src/lib/lorenz/lyapunov.ts`)

**Files:**

- Create: `src/lib/lorenz/lyapunov.ts`
- Test: `src/lib/lorenz/lyapunov.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/lorenz/lyapunov.test.ts
import { describe, expect, test } from 'bun:test';
import { estimateLargestLyapunov } from './lyapunov';
import type { LorenzIntegrationParams } from './integrators';

const base: LorenzIntegrationParams = {
	sigma: 10,
	rho: 28,
	beta: 8 / 3,
	x0: 0.1,
	y0: 0,
	z0: 0,
	solver: 'rk4',
	dt: 0.005,
	steps: 8000
};

describe('estimateLargestLyapunov', () => {
	test('classic Lorenz is chaotic with positive λ₁', () => {
		const est = estimateLargestLyapunov(base);
		expect(est.diverged).toBe(false);
		expect(est.value).toBeGreaterThan(0.5);
		expect(est.classification).toBe('chaotic');
	});

	test('low-ρ Lorenz is not chaotic', () => {
		const est = estimateLargestLyapunov({ ...base, rho: 10 });
		expect(est.value).toBeLessThan(0.1);
		expect(est.classification).not.toBe('chaotic');
	});

	test('flags diverged on a blow-up configuration', () => {
		const est = estimateLargestLyapunov({ ...base, dt: 10, steps: 200 });
		expect(est.diverged).toBe(true);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/lib/lorenz/lyapunov.test.ts`
Expected: FAIL — `./lyapunov` not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/lorenz/lyapunov.ts
import { classifyLyapunov, type LyapunovEstimate } from '$lib/chua';
import { lorenzDeriv, type LorenzIntegrationParams, type LorenzPoint } from './integrators';

/** Fixed step budget for the λ₁ estimate, independent of the display trail length. */
export const LYAPUNOV_STEPS = 8000;

function rk4(
	state: LorenzPoint,
	sigma: number,
	rho: number,
	beta: number,
	dt: number
): LorenzPoint {
	const { x, y, z } = state;
	const k1 = lorenzDeriv(x, y, z, sigma, rho, beta);
	const k2 = lorenzDeriv(
		x + (dt / 2) * k1.dx,
		y + (dt / 2) * k1.dy,
		z + (dt / 2) * k1.dz,
		sigma,
		rho,
		beta
	);
	const k3 = lorenzDeriv(
		x + (dt / 2) * k2.dx,
		y + (dt / 2) * k2.dy,
		z + (dt / 2) * k2.dz,
		sigma,
		rho,
		beta
	);
	const k4 = lorenzDeriv(x + dt * k3.dx, y + dt * k3.dy, z + dt * k3.dz, sigma, rho, beta);
	return {
		x: x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
		y: y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
		z: z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz)
	};
}

/**
 * Estimate the largest Lyapunov exponent with the Benettin two-trajectory
 * method (mirrors `$lib/chua`). Always uses RK4 internally for a stable estimate
 * even when the display solver is Euler/RK2, and its own fixed step budget.
 */
export function estimateLargestLyapunov(params: LorenzIntegrationParams): LyapunovEstimate {
	const { sigma, rho, beta, x0, y0, z0, dt } = params;
	const steps = params.steps > 0 ? params.steps : LYAPUNOV_STEPS;
	const d0 = 1e-8;

	let b: LorenzPoint = { x: x0, y: y0, z: z0 };
	let p: LorenzPoint = { x: x0 + d0, y: y0, z: z0 };

	const transient = Math.min(2000, Math.floor(steps * 0.1));
	let sumLog = 0;
	let count = 0;

	for (let i = 0; i < steps; i++) {
		const nb = rk4(b, sigma, rho, beta, dt);
		const np = rk4(p, sigma, rho, beta, dt);
		if (
			!Number.isFinite(nb.x) ||
			!Number.isFinite(nb.y) ||
			!Number.isFinite(nb.z) ||
			!Number.isFinite(np.x) ||
			!Number.isFinite(np.y) ||
			!Number.isFinite(np.z)
		) {
			return { value: NaN, classification: 'marginal', diverged: true };
		}
		b = nb;
		p = np;

		if (i >= transient) {
			const dx = p.x - b.x;
			const dy = p.y - b.y;
			const dz = p.z - b.z;
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (Number.isFinite(dist) && dist > 0) {
				sumLog += Math.log(dist / d0);
				count++;
				const factor = d0 / dist;
				p = { x: b.x + dx * factor, y: b.y + dy * factor, z: b.z + dz * factor };
			}
		}
	}

	const value = count > 0 ? sumLog / (count * dt) : 0;
	return { value, classification: classifyLyapunov(value), diverged: false };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/lib/lorenz/lyapunov.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/lorenz/lyapunov.ts src/lib/lorenz/lyapunov.test.ts
git commit -m "feat(lorenz): add Benettin Lyapunov estimate"
```

---

# Phase 2 — Data model, validation & persistence

## Task 6: Extend `LorenzParameters` and add unions (`src/lib/types.ts`)

**Files:**

- Modify: `src/lib/types.ts:27-32` (the `LorenzParameters` interface) and add new exported unions near it.
- Test: `src/lib/types.test.ts` (add a compile-style assertion test)

- [ ] **Step 1: Write the failing test**

```ts
// Append to src/lib/types.test.ts
import { describe, expect, test } from 'bun:test';
import type { LorenzParameters } from './types';

describe('LorenzParameters extended fields', () => {
	test('accepts a fully-populated object', () => {
		const p: LorenzParameters = {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3,
			x0: 0.1,
			y0: 0,
			z0: 0,
			epsilon: 0.001,
			showGhost: true,
			solver: 'rk4',
			dt: 0.005,
			stepsPerFrame: 5,
			speed: 1,
			colorMode: 'divergence',
			trailLength: 15000,
			trailStyle: 'comet',
			viewMode: 'xy',
			autoRotate: true,
			rotationSpeed: 0.5,
			zoom: 1
		};
		expect(p.type).toBe('lorenz');
	});

	test('accepts a legacy sigma/rho/beta-only object', () => {
		const p: LorenzParameters = { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 };
		expect(p.sigma).toBe(10);
	});
});
```

> If `src/lib/types.test.ts` does not exist, create it with the imports above.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run check`
Expected: FAIL — properties like `solver`, `colorMode` do not exist on `LorenzParameters`.

- [ ] **Step 3: Edit `src/lib/types.ts`**

Replace the existing interface (lines 27-32):

```ts
export interface LorenzParameters {
	type: 'lorenz';
	sigma: number;
	rho: number;
	beta: number;
}
```

with:

```ts
export type LorenzSolver = 'euler' | 'rk2' | 'rk4';
export type LorenzColorMode = 'time' | 'speed' | 'zheight' | 'divergence' | 'single';
export type LorenzTrailStyle = 'comet' | 'cumulative';
export type LorenzViewMode = '3d' | 'xy' | 'xz' | 'yz';

export interface LorenzParameters {
	type: 'lorenz';
	sigma: number;
	rho: number;
	beta: number;
	// Optional extended controls (added by the control-suite feature).
	// All optional for backward compatibility with legacy σ/ρ/β-only configs.
	x0?: number;
	y0?: number;
	z0?: number;
	epsilon?: number;
	showGhost?: boolean;
	solver?: LorenzSolver;
	dt?: number;
	stepsPerFrame?: number;
	speed?: number;
	colorMode?: LorenzColorMode;
	trailLength?: number;
	trailStyle?: LorenzTrailStyle;
	viewMode?: LorenzViewMode;
	autoRotate?: boolean;
	rotationSpeed?: number;
	zoom?: number;
}
```

- [ ] **Step 4: Verify type-check and unit tests pass**

Run: `bun run check` → Expected: PASS (Tasks 1, 2, 4, 5 imports now resolve).
Run: `bun test src/lib/lorenz` → Expected: PASS (all Phase 1 modules).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat(lorenz): extend LorenzParameters with control-suite fields"
```

---

## Task 7: Teach `validateParameters` Lorenz's optional typed fields (`src/lib/chaos-validation.ts`)

**Why:** `validateParameters` gates save (`/api/save-config`), share (`/api/share`), saved-config load, and comparison decode. It currently rejects non-numeric values and keys outside `STABLE_RANGES`. Without this change, saving/sharing/loading any enhanced Lorenz config fails. σ/ρ/β stay the only _required_ keys (legacy configs keep working); new fields are validated only when present.

**Files:**

- Modify: `src/lib/chaos-validation.ts` (add `OPTIONAL_FIELDS`, extend `validateParameters` extra-key + value checks, extend `checkParameterStability` warnings)
- Test: `src/lib/chaos-validation.test.ts` (add cases)

- [ ] **Step 1: Write the failing test**

```ts
// Append to src/lib/chaos-validation.test.ts
import { describe, expect, test } from 'bun:test';
import { validateParameters, checkParameterStability } from './chaos-validation';

describe('Lorenz extended-field validation', () => {
	const full = {
		type: 'lorenz' as const,
		sigma: 10,
		rho: 28,
		beta: 8 / 3,
		x0: 0.1,
		y0: 0,
		z0: 0,
		epsilon: 0.001,
		showGhost: true,
		solver: 'rk4',
		dt: 0.005,
		stepsPerFrame: 5,
		speed: 1,
		colorMode: 'time',
		trailLength: 15000,
		trailStyle: 'comet',
		viewMode: '3d',
		autoRotate: true,
		rotationSpeed: 0.5,
		zoom: 1
	};

	test('accepts a fully-populated Lorenz config', () => {
		const result = validateParameters('lorenz', full);
		expect(result.isValid).toBe(true);
	});

	test('still accepts a legacy sigma/rho/beta-only config', () => {
		const result = validateParameters('lorenz', {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3
		});
		expect(result.isValid).toBe(true);
	});

	test('rejects an invalid solver enum value', () => {
		const result = validateParameters('lorenz', { ...full, solver: 'verlet' });
		expect(result.isValid).toBe(false);
	});

	test('rejects a non-boolean showGhost', () => {
		const result = validateParameters('lorenz', { ...full, showGhost: 'yes' });
		expect(result.isValid).toBe(false);
	});

	test('warns when dt is too large with the euler solver', () => {
		const result = checkParameterStability('lorenz', { ...full, solver: 'euler', dt: 0.05 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toMatch(/dt|Euler|euler/);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test src/lib/chaos-validation.test.ts`
Expected: FAIL — full config is rejected (unexpected params / non-number values).

- [ ] **Step 3: Edit `src/lib/chaos-validation.ts`**

After the `STABLE_RANGES` constant (around line 93), add:

```ts
/** Kinds for optional, non-range Lorenz fields validated only when present. */
type OptionalFieldKind =
	| { kind: 'number'; min?: number; max?: number }
	| { kind: 'enum'; values: readonly string[] }
	| { kind: 'boolean' };

/**
 * Optional typed fields beyond the core numeric ranges, per map type.
 * Present => validated by kind; absent => fine (backward compatible).
 */
const OPTIONAL_FIELDS: Partial<Record<ChaosMapType, Record<string, OptionalFieldKind>>> = {
	lorenz: {
		x0: { kind: 'number' },
		y0: { kind: 'number' },
		z0: { kind: 'number' },
		epsilon: { kind: 'number', min: 0 },
		showGhost: { kind: 'boolean' },
		solver: { kind: 'enum', values: ['euler', 'rk2', 'rk4'] },
		dt: { kind: 'number', min: 0 },
		stepsPerFrame: { kind: 'number', min: 1 },
		speed: { kind: 'number', min: 0 },
		colorMode: { kind: 'enum', values: ['time', 'speed', 'zheight', 'divergence', 'single'] },
		trailLength: { kind: 'number', min: 1 },
		trailStyle: { kind: 'enum', values: ['comet', 'cumulative'] },
		viewMode: { kind: 'enum', values: ['3d', 'xy', 'xz', 'yz'] },
		autoRotate: { kind: 'boolean' },
		rotationSpeed: { kind: 'number' },
		zoom: { kind: 'number', min: 0 }
	}
};
```

In `validateParameters`, replace the extra-key block:

```ts
// Check for extra keys (but allow 'type' field as it's used for discriminated unions)
const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key) && key !== 'type');
if (extraKeys.length > 0) {
	errors.push(`Unexpected parameters: ${extraKeys.join(', ')}`);
}

// Check that all values are numbers (except 'type' field which is a string)
for (const key of actualKeys) {
	if (key === 'type') continue;
	const value = paramObj[key];
	if (typeof value !== 'number' || isNaN(value)) {
		errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
	}
}
```

with:

```ts
const optionalFields = OPTIONAL_FIELDS[mapType] ?? {};

// Check for extra keys (allow 'type' and any declared optional field).
const extraKeys = actualKeys.filter(
	(key) => !expectedKeys.includes(key) && key !== 'type' && !(key in optionalFields)
);
if (extraKeys.length > 0) {
	errors.push(`Unexpected parameters: ${extraKeys.join(', ')}`);
}

// Validate values: range keys + optional-field keys must be numbers;
// optional enum/boolean fields are validated by their declared kind.
for (const key of actualKeys) {
	if (key === 'type') continue;
	const value = paramObj[key];
	const spec = optionalFields[key];
	if (spec) {
		if (spec.kind === 'number') {
			if (typeof value !== 'number' || isNaN(value)) {
				errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
			}
		} else if (spec.kind === 'boolean') {
			if (typeof value !== 'boolean') {
				errors.push(`Parameter '${key}' must be a boolean, got: ${typeof value}`);
			}
		} else if (spec.kind === 'enum') {
			if (typeof value !== 'string' || !spec.values.includes(value)) {
				errors.push(
					`Parameter '${key}' must be one of [${spec.values.join(', ')}], got: ${String(value)}`
				);
			}
		}
		continue;
	}
	// Core range field (or unexpected, already reported): must be a number.
	if (typeof value !== 'number' || isNaN(value)) {
		errors.push(`Parameter '${key}' must be a valid number, got: ${typeof value}`);
	}
}
```

Then in `checkParameterStability`, before the final `return`, add Lorenz-specific dt/epsilon warnings (insert a new `case 'lorenz':` into the existing `switch (mapType)` block):

```ts
		case 'lorenz': {
			const dt = paramRecord.dt;
			const solver = (normalizedParams as Record<string, unknown>).solver;
			if (typeof dt === 'number') {
				if (dt <= 0 || dt > 0.02) {
					warnings.push(`dt (${dt}) is outside the recommended range (0, 0.02]`);
				}
				if (solver === 'euler' && dt > 0.01) {
					warnings.push(
						`Euler integration with dt=${dt} is prone to numerical blow-up; reduce dt or use RK4`
					);
				}
			}
			const epsilon = paramRecord.epsilon;
			if (typeof epsilon === 'number' && epsilon <= 0) {
				warnings.push(`epsilon (${epsilon}) must be positive for the perturbed orbit`);
			}
			break;
		}
```

> NOTE: `paramRecord` is typed `Record<string, number>`; reading `.solver` (a string) needs the `normalizedParams` cast shown above. `dt`/`epsilon` are numbers so `paramRecord` access is fine.

- [ ] **Step 4: Run tests**

Run: `bun test src/lib/chaos-validation.test.ts` → Expected: PASS.
Run: `bun run check` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/chaos-validation.ts src/lib/chaos-validation.test.ts
git commit -m "feat(lorenz): validate extended fields in chaos-validation"
```

---

## Task 8: Backward-compatible type guard test (`src/lib/type-guards.ts`)

**Why:** `isLorenzParameters` already only checks `type === 'lorenz'`, so it is already tolerant of extended fields. This task adds a regression test to lock that in (no code change unless the test fails).

**Files:**

- Test: `src/lib/type-guards.test.ts` (add a case)

- [ ] **Step 1: Add the test**

```ts
// Append to src/lib/type-guards.test.ts
import { describe, expect, test } from 'bun:test';
import { isLorenzParameters } from './type-guards';

describe('isLorenzParameters with extended fields', () => {
	test('accepts an extended Lorenz config', () => {
		expect(
			isLorenzParameters({
				type: 'lorenz',
				sigma: 10,
				rho: 28,
				beta: 8 / 3,
				solver: 'rk4',
				showGhost: true,
				colorMode: 'divergence'
			})
		).toBe(true);
	});

	test('accepts a legacy Lorenz config', () => {
		expect(isLorenzParameters({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })).toBe(true);
	});
});
```

- [ ] **Step 2: Run the test**

Run: `bun test src/lib/type-guards.test.ts`
Expected: PASS (guard already tolerant). If it fails, the guard was changed elsewhere — restore it to `return params?.type === 'lorenz';`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/type-guards.test.ts
git commit -m "test(lorenz): lock in tolerant isLorenzParameters guard"
```

---

## Task 9: Add `COMET_WINDOW` constant (`src/lib/constants.ts`)

**Files:**

- Modify: `src/lib/constants.ts` (Three.js Constants section, after `AUTO_ROTATE_SPEED`)

- [ ] **Step 1: Add the constant**

After line 96 (`export const AUTO_ROTATE_SPEED = 0.5;`), add:

```ts
/**
 * Number of trailing points shown by the Lorenz "comet" trail style.
 * Independent of the trajectory length (TRAIL_LENGTH controls total points).
 */
export const COMET_WINDOW = 2000;
```

- [ ] **Step 2: Verify build**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(lorenz): add COMET_WINDOW constant"
```

---

# Phase 3 — Renderer engine

## Task 10: Rewrite `LorenzRenderer.svelte` props & integration to a params object

**Files:**

- Modify (full rewrite): `src/lib/components/visualizations/LorenzRenderer.svelte`
- Modify: `src/routes/lorenz/compare/+page.svelte:199-206` and `:284-291` (pass a `params` object instead of `bind:sigma/rho/beta`)
- Modify: `src/lib/components/visualizations/LorenzRenderer.vitest.ts` (props now use `params`)

The renderer takes a `params: LorenzParameters` prop (resolved internally via `withLorenzDefaults`), runtime playback props, and exposes `head`/`diverged` as bindable outputs. It precomputes the trajectory (+ optional ghost) on math-affecting changes, animates the `head` each frame, draws comet vs cumulative, switches perspective/orthographic cameras like `ChuaRenderer`, and preserves compare-mode behavior (full static attractor + camera sync).

- [ ] **Step 1: Update the vitest props first (failing test)**

Replace the body of `src/lib/components/visualizations/LorenzRenderer.vitest.ts` render calls so every `render(LorenzRenderer, { props: { sigma, rho, beta, height, … } })` becomes a `params`-based call. Replace the three `describe` blocks' render calls as follows (keep the existing `vi.mock(...)` blocks at the top unchanged, but add `OrthographicCamera` to the `three` mock):

In the `vi.mock('three', …)` object, add after `PerspectiveCamera`:

```ts
		OrthographicCamera: vi.fn().mockImplementation(function () {
			return {
				position: { set: vi.fn(), x: 0, y: 0, z: 30 },
				left: -10,
				right: 10,
				top: 10,
				bottom: -10,
				zoom: 1,
				updateProjectionMatrix: vi.fn()
			};
		}),
```

Replace all four test bodies' props with a `params` object, e.g.:

```ts
it('renders without throwing', () => {
	expect(() =>
		render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		})
	).not.toThrow();
});
```

Apply the same `params`-object shape to every other `render(LorenzRenderer, …)` call in the file (smoke, different-props, compare-mode, three-integration). For compare mode add `compareMode: true, compareSide: 'left'` (and `'right'`) alongside `params` and `height`.

- [ ] **Step 2: Run vitest to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/LorenzRenderer.vitest.ts`
Expected: FAIL — renderer still expects `sigma/rho/beta` props; `params` undefined causes errors.

- [ ] **Step 3: Rewrite `src/lib/components/visualizations/LorenzRenderer.svelte`**

Replace the entire file with:

```svelte
<!--
  LorenzRenderer Component

  Three.js renderer for the Lorenz attractor. Precomputes the trajectory on
  math-affecting changes (Approach A) and animates a `head` index across it.
  Supports comet vs cumulative trails, color modes, a ghost (perturbed) orbit,
  perspective 3D + orthographic XY/XZ/YZ projections, playback (play/pause/step/
  reset/speed), and comparison mode with camera sync.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { Line2 } from 'three/examples/jsm/lines/Line2.js';
	import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
	import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
	import { cameraSyncStore, createCameraState, applyCameraState } from '$lib/stores/camera-sync';
	import { AUTO_ROTATE_SPEED, COMET_WINDOW } from '$lib/constants';
	import { integrate, type LorenzResult } from '$lib/lorenz/integrators';
	import { computeColors } from '$lib/lorenz/colors';
	import { withLorenzDefaults } from '$lib/lorenz/defaults';
	import type { LorenzParameters } from '$lib/types';

	interface Props {
		params: LorenzParameters;
		height?: number;
		compareMode?: boolean;
		compareSide?: 'left' | 'right';
		containerElement?: HTMLDivElement;
		// Runtime playback (main page only).
		isPlaying?: boolean;
		stepNonce?: number;
		resetNonce?: number;
		// Outputs.
		head?: number;
		diverged?: boolean;
	}

	let {
		params,
		height = 600,
		compareMode = false,
		compareSide = 'left',
		containerElement = $bindable(),
		isPlaying = true,
		stepNonce = 0,
		resetNonce = 0,
		head = $bindable(0),
		diverged = $bindable(false)
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	$effect(() => {
		containerElement = container;
	});

	const resolved = $derived(withLorenzDefaults(params));

	let isAnimating = true;
	let animationFrameId: number | null = null;
	let rebuild: (() => void) | null = null;
	let applyView: (() => void) | null = null;
	let applyColors: (() => void) | null = null;

	let controls = $state<OrbitControls | null>(null);
	let perspectiveCamera = $state<THREE.PerspectiveCamera | null>(null);

	// Recompute geometry when math-affecting params change.
	$effect(() => {
		void resolved.sigma;
		void resolved.rho;
		void resolved.beta;
		void resolved.x0;
		void resolved.y0;
		void resolved.z0;
		void resolved.epsilon;
		void resolved.showGhost;
		void resolved.solver;
		void resolved.dt;
		void resolved.trailLength;
		void resolved.trailStyle;
		rebuild?.();
		untrack(() => applyView?.());
	});

	// Recompute colors only (cheap) when colorMode changes.
	$effect(() => {
		void resolved.colorMode;
		applyColors?.();
	});

	// Reapply camera/visibility when the view mode / rotation / zoom change.
	$effect(() => {
		void resolved.viewMode;
		void resolved.autoRotate;
		void resolved.rotationSpeed;
		void resolved.zoom;
		applyView?.();
	});

	// Reset playback head on resetNonce change.
	$effect(() => {
		void resetNonce;
		head = 0;
	});

	// Single-step on stepNonce change.
	let lastStepNonce = stepNonce;
	$effect(() => {
		if (stepNonce !== lastStepNonce) {
			lastStepNonce = stepNonce;
			advanceHead(true);
		}
	});

	function advanceHead(forceOneFrame = false): void {
		const total = resolved.trailLength;
		const perFrame = Math.max(1, Math.round(resolved.stepsPerFrame * resolved.speed));
		if (forceOneFrame || isPlaying) {
			head = Math.min(total, head + perFrame);
		}
	}

	// Camera sync (perspective / 3D only).
	$effect(() => {
		if (!compareMode) return;
		const c = controls;
		const cam = perspectiveCamera;
		if (!c || !cam) return;
		const side = compareSide;
		const unsubscribe = cameraSyncStore.subscribe((state) => {
			if (!state.enabled || state.lastUpdate === side) return;
			const other = side === 'left' ? state.right : state.left;
			if (other) applyCameraState(other, cam, c);
		});
		return unsubscribe;
	});

	onMount(() => {
		if (!container) return;
		const el = container;

		const scene = new THREE.Scene();
		scene.background = null;

		const persp = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 1000);
		persp.position.set(40, 40, 40);
		perspectiveCamera = persp;

		const ortho = new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 2000);
		let activeCamera: THREE.Camera = persp;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(el.clientWidth, el.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		el.appendChild(renderer.domElement);

		const orbit = new OrbitControls(persp, renderer.domElement);
		orbit.enableDamping = true;
		orbit.autoRotate = !compareMode && resolved.autoRotate;
		orbit.autoRotateSpeed = resolved.rotationSpeed;
		controls = orbit;

		let cameraChangeHandler: (() => void) | null = null;
		if (compareMode) {
			cameraChangeHandler = () => {
				cameraSyncStore.updateFromSide(compareSide, createCameraState(persp, orbit));
			};
			orbit.addEventListener('change', cameraChangeHandler);
		}

		const gridHelper = new THREE.GridHelper(100, 20, 0x00f3ff, 0x2d1b69);
		gridHelper.position.y = -30;
		(gridHelper.material as THREE.Material).transparent = true;
		(gridHelper.material as THREE.Material).opacity = 0.2;
		scene.add(gridHelper);

		// Trajectory state.
		let main: LorenzResult | null = null;
		let ghost: LorenzResult | null = null;
		let mainColors: Float32Array = new Float32Array(0);

		function makeLine(): Line2 {
			const geometry = new LineGeometry();
			const material = new LineMaterial({
				vertexColors: true,
				linewidth: 2,
				blending: THREE.AdditiveBlending,
				transparent: true,
				opacity: 0.8
			});
			material.resolution.set(el.clientWidth, el.clientHeight);
			const line = new Line2(geometry, material);
			line.computeLineDistances();
			return line;
		}

		const mainLine = makeLine();
		const ghostLine = makeLine();
		scene.add(mainLine);
		scene.add(ghostLine);

		function disposeLineGeometry(line: Line2) {
			line.geometry.dispose();
		}

		rebuild = () => {
			const r = resolved;
			main = integrate({
				sigma: r.sigma,
				rho: r.rho,
				beta: r.beta,
				x0: r.x0,
				y0: r.y0,
				z0: r.z0,
				solver: r.solver,
				dt: r.dt,
				steps: r.trailLength
			});
			ghost = r.showGhost
				? integrate({
						sigma: r.sigma,
						rho: r.rho,
						beta: r.beta,
						x0: r.x0 + r.epsilon,
						y0: r.y0,
						z0: r.z0,
						solver: r.solver,
						dt: r.dt,
						steps: r.trailLength
					})
				: null;
			diverged = main.diverged || (ghost?.diverged ?? false);
			ghostLine.visible = !!ghost;
			// In compare mode show the full static attractor.
			if (compareMode) head = r.trailLength;
			else if (head > r.trailLength) head = r.trailLength;
			applyColors?.();
		};

		applyColors = () => {
			if (!main) return;
			mainColors = computeColors(main, resolved.colorMode, { ghost: ghost ?? undefined });
		};

		function setLineSlice(
			line: Line2,
			result: LorenzResult,
			colors: Float32Array,
			from: number,
			to: number
		) {
			const count = Math.max(0, to - from);
			if (count < 2) {
				line.visible = false;
				return;
			}
			line.visible = true;
			const pos = result.positions.subarray(from * 3, to * 3);
			const col = colors.subarray(from * 3, to * 3);
			line.geometry.setPositions(Array.from(pos));
			line.geometry.setColors(Array.from(col));
			line.computeLineDistances();
		}

		function updateDraw() {
			if (!main) return;
			const total = resolved.trailLength;
			const h = Math.min(head, total);
			if (resolved.trailStyle === 'comet') {
				const from = Math.max(0, h - COMET_WINDOW);
				setLineSlice(mainLine, main, mainColors, from, h);
				if (ghost) {
					const gColors = computeColors(ghost, resolved.colorMode, { ghost: main });
					setLineSlice(ghostLine, ghost, gColors, from, h);
				}
			} else {
				setLineSlice(mainLine, main, mainColors, 0, h);
				if (ghost) {
					const gColors = computeColors(ghost, resolved.colorMode, { ghost: main });
					setLineSlice(ghostLine, ghost, gColors, 0, h);
				}
			}
		}

		applyView = () => {
			const r = resolved;
			if (r.viewMode === '3d') {
				activeCamera = persp;
				orbit.enabled = true;
				orbit.autoRotate = !compareMode && r.autoRotate;
				orbit.autoRotateSpeed = r.rotationSpeed;
				persp.position.set(40 / r.zoom, 40 / r.zoom, 40 / r.zoom);
			} else {
				activeCamera = ortho;
				orbit.autoRotate = false;
				const d = 80 / r.zoom;
				if (r.viewMode === 'xy') ortho.position.set(0, 0, d);
				else if (r.viewMode === 'xz') ortho.position.set(0, d, 0);
				else ortho.position.set(d, 0, 0); // yz
				ortho.lookAt(0, 0, 0);
				ortho.updateProjectionMatrix();
			}
		};

		rebuild();
		applyView();

		function animate() {
			if (!isAnimating) return;
			animationFrameId = requestAnimationFrame(animate);
			if (!compareMode) advanceHead(false);
			updateDraw();
			if (controls && activeCamera === persp) controls.update();
			renderer.render(scene, activeCamera);
		}
		animate();

		const handleResize = () => {
			if (!container) return;
			persp.aspect = container.clientWidth / container.clientHeight;
			persp.updateProjectionMatrix();
			renderer.setSize(container.clientWidth, container.clientHeight);
			(mainLine.material as LineMaterial).resolution.set(
				container.clientWidth,
				container.clientHeight
			);
			(ghostLine.material as LineMaterial).resolution.set(
				container.clientWidth,
				container.clientHeight
			);
		};
		window.addEventListener('resize', handleResize);
		const resizeObserver = new ResizeObserver(() => handleResize());
		resizeObserver.observe(el);
		handleResize();

		return () => {
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
			isAnimating = false;
			if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
			if (cameraChangeHandler) orbit.removeEventListener('change', cameraChangeHandler);
			orbit.dispose();
			scene.remove(gridHelper);
			gridHelper.geometry.dispose();
			(gridHelper.material as THREE.Material).dispose();
			scene.remove(mainLine);
			scene.remove(ghostLine);
			disposeLineGeometry(mainLine);
			disposeLineGeometry(ghostLine);
			(mainLine.material as LineMaterial).dispose();
			(ghostLine.material as LineMaterial).dispose();
			renderer.dispose();
			if (renderer.domElement.parentNode === el) {
				// eslint-disable-next-line svelte/no-dom-manipulating
				el.removeChild(renderer.domElement);
			}
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative"
	style="height: {height}px;"
>
	<div
		class="absolute top-4 right-4 text-xs font-['Rajdhani'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		LIVE_RENDER // THREE_JS
	</div>
</div>
```

- [ ] **Step 4: Update the compare page to pass a `params` object**

In `src/routes/lorenz/compare/+page.svelte`, replace the left renderer (lines ~199-206):

```svelte
<LorenzRenderer
	bind:sigma={leftSigma}
	bind:rho={leftRho}
	bind:beta={leftBeta}
	height={400}
	compareMode={true}
	compareSide="left"
/>
```

with:

```svelte
<LorenzRenderer
	params={{ type: 'lorenz', sigma: leftSigma, rho: leftRho, beta: leftBeta }}
	height={400}
	compareMode={true}
	compareSide="left"
/>
```

And the right renderer (lines ~284-291) similarly using `rightSigma/rightRho/rightBeta` and `compareSide="right"`.

- [ ] **Step 5: Run vitest + type-check**

Run: `bunx vitest run src/lib/components/visualizations/LorenzRenderer.vitest.ts`
Expected: PASS (the mocked three classes record construction; the renderer mounts).
Run: `bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/LorenzRenderer.svelte src/lib/components/visualizations/LorenzRenderer.vitest.ts src/routes/lorenz/compare/+page.svelte
git commit -m "feat(lorenz): rewrite renderer with animated-head engine"
```

---

## Task 11: Renderer behavior test — ghost line + compare-mode static

**Files:**

- Modify: `src/lib/components/visualizations/LorenzRenderer.vitest.ts` (add cases)

- [ ] **Step 1: Add tests**

```ts
// Append inside src/lib/components/visualizations/LorenzRenderer.vitest.ts
describe('LorenzRenderer engine behavior', () => {
	afterEach(() => {
		cleanup();
	});

	it('constructs an OrthographicCamera for projection support', async () => {
		const THREE = await import('three');
		render(LorenzRenderer, {
			props: {
				params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, viewMode: 'xy' },
				height: 200
			}
		});
		expect(THREE.OrthographicCamera).toHaveBeenCalled();
	});

	it('creates two Line2 instances (main + ghost) when ghost is enabled', async () => {
		const { Line2 } = await import('three/examples/jsm/lines/Line2.js');
		(Line2 as unknown as { mockClear: () => void }).mockClear?.();
		render(LorenzRenderer, {
			props: {
				params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, showGhost: true },
				height: 200
			}
		});
		expect(
			(Line2 as unknown as { mock: { calls: unknown[] } }).mock.calls.length
		).toBeGreaterThanOrEqual(2);
	});

	it('renders in compare mode without throwing', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
					height: 200,
					compareMode: true,
					compareSide: 'left'
				}
			})
		).not.toThrow();
	});
});
```

- [ ] **Step 2: Run vitest**

Run: `bunx vitest run src/lib/components/visualizations/LorenzRenderer.vitest.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/visualizations/LorenzRenderer.vitest.ts
git commit -m "test(lorenz): cover ghost line and projection construction"
```

---

# Phase 4 — Control components

> All control components live in `src/lib/components/visualizations/lorenz/`. They use the existing sci-fi slider/label idiom (cyan `#00f3ff`, Orbitron labels, UPPERCASE_SNAKE titles). Each takes `$bindable` values and/or callback props. Each has a `*.vitest.ts` smoke + interaction test.

## Task 12: `PresetSelector.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/PresetSelector.svelte`
- Test: `src/lib/components/visualizations/lorenz/PresetSelector.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/PresetSelector.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import PresetSelector from './PresetSelector.svelte';

describe('PresetSelector', () => {
	afterEach(() => cleanup());

	it('renders all preset buttons', () => {
		const { getByText } = render(PresetSelector, {
			props: { activeId: 'classic', onSelect: vi.fn() }
		});
		expect(getByText('Classic')).toBeTruthy();
		expect(getByText('High Energy')).toBeTruthy();
	});

	it('calls onSelect with the preset σ/ρ/β when clicked', async () => {
		const onSelect = vi.fn();
		const { getByText } = render(PresetSelector, { props: { activeId: 'classic', onSelect } });
		await fireEvent.click(getByText('Stable'));
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sigma: 10, rho: 10 }));
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/PresetSelector.vitest.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/PresetSelector.svelte -->
<script lang="ts">
	import { LORENZ_PRESETS, type LorenzPreset } from '$lib/lorenz/presets';

	interface Props {
		activeId: string;
		onSelect: (preset: LorenzPreset) => void;
	}
	let { activeId, onSelect }: Props = $props();
</script>

<div class="space-y-2">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">PRESETS</span>
	<div class="flex flex-wrap gap-2">
		{#each LORENZ_PRESETS as preset (preset.id)}
			<button
				type="button"
				onclick={() => onSelect(preset)}
				class="px-3 py-1 text-xs uppercase tracking-widest font-bold rounded-sm border transition-all
					{activeId === preset.id
					? 'bg-primary/20 text-primary border-primary/60'
					: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'}"
			>
				{preset.label}
			</button>
		{/each}
	</div>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/PresetSelector.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/PresetSelector.svelte src/lib/components/visualizations/lorenz/PresetSelector.vitest.ts
git commit -m "feat(lorenz): add PresetSelector control"
```

---

## Task 13: `InitialStateControls.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/InitialStateControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/InitialStateControls.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/InitialStateControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import InitialStateControls from './InitialStateControls.svelte';

const baseProps = {
	x0: 0.1,
	y0: 0,
	z0: 0,
	epsilon: 0.001,
	showGhost: false,
	onChange: vi.fn(),
	onRandomize: vi.fn(),
	onReset: vi.fn()
};

describe('InitialStateControls', () => {
	afterEach(() => cleanup());

	it('renders the INITIAL_STATE title and ghost toggle', () => {
		const { getByText, getByLabelText } = render(InitialStateControls, { props: { ...baseProps } });
		expect(getByText('INITIAL_STATE')).toBeTruthy();
		expect(getByLabelText(/Show Perturbed Orbit/i)).toBeTruthy();
	});

	it('calls onRandomize when Randomize is clicked', async () => {
		const onRandomize = vi.fn();
		const { getByText } = render(InitialStateControls, { props: { ...baseProps, onRandomize } });
		await fireEvent.click(getByText('Randomize'));
		expect(onRandomize).toHaveBeenCalled();
	});

	it('calls onChange when the ghost toggle changes', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(InitialStateControls, { props: { ...baseProps, onChange } });
		await fireEvent.click(getByLabelText(/Show Perturbed Orbit/i));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showGhost: true }));
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/InitialStateControls.vitest.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/InitialStateControls.svelte -->
<script lang="ts">
	interface State {
		x0: number;
		y0: number;
		z0: number;
		epsilon: number;
		showGhost: boolean;
	}
	interface Props extends State {
		onChange: (next: State) => void;
		onRandomize: () => void;
		onReset: () => void;
	}
	let { x0, y0, z0, epsilon, showGhost, onChange, onRandomize, onReset }: Props = $props();

	function emit(patch: Partial<State>) {
		onChange({ x0, y0, z0, epsilon, showGhost, ...patch });
	}
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">INITIAL_STATE</span>
	<div class="grid grid-cols-2 gap-3">
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">x₀</span>
			<input
				type="number"
				step="0.1"
				value={x0}
				oninput={(e) => emit({ x0: Number(e.currentTarget.value) })}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">y₀</span>
			<input
				type="number"
				step="0.1"
				value={y0}
				oninput={(e) => emit({ y0: Number(e.currentTarget.value) })}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">z₀</span>
			<input
				type="number"
				step="0.1"
				value={z0}
				oninput={(e) => emit({ z0: Number(e.currentTarget.value) })}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
		<label class="space-y-1 block">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">ε</span>
			<input
				type="number"
				step="0.0001"
				value={epsilon}
				oninput={(e) => emit({ epsilon: Number(e.currentTarget.value) })}
				class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
			/>
		</label>
	</div>
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={onRandomize}
			class="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20"
		>
			Randomize
		</button>
		<button
			type="button"
			onclick={onReset}
			class="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20"
		>
			Reset
		</button>
	</div>
	<label class="flex items-center gap-2 text-primary/80 text-xs uppercase tracking-widest">
		<input
			type="checkbox"
			checked={showGhost}
			onchange={(e) => emit({ showGhost: e.currentTarget.checked })}
			class="accent-accent"
		/>
		Show Perturbed Orbit
	</label>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/InitialStateControls.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/InitialStateControls.svelte src/lib/components/visualizations/lorenz/InitialStateControls.vitest.ts
git commit -m "feat(lorenz): add InitialStateControls"
```

---

## Task 14: `PlaybackControls.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/PlaybackControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/PlaybackControls.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/PlaybackControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import PlaybackControls from './PlaybackControls.svelte';

const base = {
	isPlaying: true,
	speed: 1,
	onTogglePlay: vi.fn(),
	onStep: vi.fn(),
	onReset: vi.fn(),
	onSpeedChange: vi.fn()
};

describe('PlaybackControls', () => {
	afterEach(() => cleanup());

	it('shows Pause when playing and Play when paused', () => {
		const { getByText, rerender } = render(PlaybackControls, {
			props: { ...base, isPlaying: true }
		});
		expect(getByText(/Pause/i)).toBeTruthy();
		rerender({ ...base, isPlaying: false });
		expect(getByText(/Play/i)).toBeTruthy();
	});

	it('calls onStep and onReset', async () => {
		const onStep = vi.fn();
		const onReset = vi.fn();
		const { getByText } = render(PlaybackControls, { props: { ...base, onStep, onReset } });
		await fireEvent.click(getByText('Step'));
		await fireEvent.click(getByText('Reset'));
		expect(onStep).toHaveBeenCalled();
		expect(onReset).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/PlaybackControls.vitest.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/PlaybackControls.svelte -->
<script lang="ts">
	interface Props {
		isPlaying: boolean;
		speed: number;
		onTogglePlay: () => void;
		onStep: () => void;
		onReset: () => void;
		onSpeedChange: (speed: number) => void;
	}
	let { isPlaying, speed, onTogglePlay, onStep, onReset, onSpeedChange }: Props = $props();
	const btn =
		'px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20';
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">SIMULATION</span>
	<div class="flex items-center gap-2">
		<button type="button" class={btn} onclick={onTogglePlay}>{isPlaying ? 'Pause' : 'Play'}</button>
		<button type="button" class={btn} onclick={onStep}>Step</button>
		<button type="button" class={btn} onclick={onReset}>Reset</button>
	</div>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Speed</span>
			<span class="font-mono text-accent text-sm">{speed.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0.1"
			max="5"
			step="0.1"
			value={speed}
			oninput={(e) => onSpeedChange(Number(e.currentTarget.value))}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/PlaybackControls.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/PlaybackControls.svelte src/lib/components/visualizations/lorenz/PlaybackControls.vitest.ts
git commit -m "feat(lorenz): add PlaybackControls"
```

---

## Task 15: `TrailControls.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/TrailControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/TrailControls.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/TrailControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import TrailControls from './TrailControls.svelte';

const base = {
	trailLength: 15000,
	trailStyle: 'comet' as const,
	onLengthChange: vi.fn(),
	onStyleChange: vi.fn()
};

describe('TrailControls', () => {
	afterEach(() => cleanup());

	it('renders the TRAIL_LENGTH title and current length', () => {
		const { getByText } = render(TrailControls, { props: { ...base } });
		expect(getByText('TRAIL_LENGTH')).toBeTruthy();
		expect(getByText(/15000|15,000/)).toBeTruthy();
	});

	it('calls onStyleChange when switching to cumulative', async () => {
		const onStyleChange = vi.fn();
		const { getByText } = render(TrailControls, { props: { ...base, onStyleChange } });
		await fireEvent.click(getByText(/Cumulative/i));
		expect(onStyleChange).toHaveBeenCalledWith('cumulative');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/TrailControls.vitest.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/TrailControls.svelte -->
<script lang="ts">
	import type { LorenzTrailStyle } from '$lib/types';
	interface Props {
		trailLength: number;
		trailStyle: LorenzTrailStyle;
		onLengthChange: (length: number) => void;
		onStyleChange: (style: LorenzTrailStyle) => void;
	}
	let { trailLength, trailStyle, onLengthChange, onStyleChange }: Props = $props();
	const styleBtn = (active: boolean) =>
		`px-3 py-1 text-xs uppercase tracking-widest font-bold rounded-sm border transition-all ${
			active
				? 'bg-primary/20 text-primary border-primary/60'
				: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'
		}`;
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">TRAIL_LENGTH</span>
	<div class="flex justify-between items-end">
		<span class="text-primary/60 text-[10px] uppercase tracking-widest">Points</span>
		<span class="font-mono text-accent text-sm">{trailLength.toLocaleString()}</span>
	</div>
	<input
		type="range"
		min="2000"
		max="100000"
		step="1000"
		value={trailLength}
		oninput={(e) => onLengthChange(Number(e.currentTarget.value))}
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
	/>
	<div class="flex gap-2">
		<button
			type="button"
			class={styleBtn(trailStyle === 'comet')}
			onclick={() => onStyleChange('comet')}
		>
			Comet
		</button>
		<button
			type="button"
			class={styleBtn(trailStyle === 'cumulative')}
			onclick={() => onStyleChange('cumulative')}
		>
			Cumulative
		</button>
	</div>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/TrailControls.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/TrailControls.svelte src/lib/components/visualizations/lorenz/TrailControls.vitest.ts
git commit -m "feat(lorenz): add TrailControls"
```

---

## Task 16: `ColorModeSelector.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/ColorModeSelector.svelte`
- Test: `src/lib/components/visualizations/lorenz/ColorModeSelector.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/ColorModeSelector.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import ColorModeSelector from './ColorModeSelector.svelte';

const base = { colorMode: 'time' as const, ghostEnabled: false, onChange: vi.fn() };

describe('ColorModeSelector', () => {
	afterEach(() => cleanup());

	it('renders all five modes', () => {
		const { getByLabelText } = render(ColorModeSelector, { props: { ...base } });
		for (const label of ['Time', 'Speed', 'Z-height', 'Divergence', 'Single']) {
			expect(getByLabelText(new RegExp(label, 'i'))).toBeTruthy();
		}
	});

	it('disables Divergence when ghost is off', () => {
		const { getByLabelText } = render(ColorModeSelector, {
			props: { ...base, ghostEnabled: false }
		});
		expect((getByLabelText(/Divergence/i) as HTMLInputElement).disabled).toBe(true);
	});

	it('emits the chosen mode', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(ColorModeSelector, { props: { ...base, onChange } });
		await fireEvent.click(getByLabelText(/Z-height/i));
		expect(onChange).toHaveBeenCalledWith('zheight');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/ColorModeSelector.vitest.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/ColorModeSelector.svelte -->
<script lang="ts">
	import type { LorenzColorMode } from '$lib/types';
	interface Props {
		colorMode: LorenzColorMode;
		ghostEnabled: boolean;
		onChange: (mode: LorenzColorMode) => void;
	}
	let { colorMode, ghostEnabled, onChange }: Props = $props();
	const modes: { value: LorenzColorMode; label: string }[] = [
		{ value: 'time', label: 'Time' },
		{ value: 'speed', label: 'Speed' },
		{ value: 'zheight', label: 'Z-height' },
		{ value: 'divergence', label: 'Divergence' },
		{ value: 'single', label: 'Single' }
	];
</script>

<div class="space-y-2">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">COLOR_MODE</span>
	<div class="grid grid-cols-2 gap-1">
		{#each modes as mode (mode.value)}
			{@const disabled = mode.value === 'divergence' && !ghostEnabled}
			<label class="flex items-center gap-2 text-xs {disabled ? 'opacity-40' : 'text-primary/80'}">
				<input
					type="radio"
					name="lorenz-color-mode"
					value={mode.value}
					checked={colorMode === mode.value}
					{disabled}
					onchange={() => onChange(mode.value)}
					class="accent-accent"
				/>
				{mode.label}
			</label>
		{/each}
	</div>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/ColorModeSelector.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/ColorModeSelector.svelte src/lib/components/visualizations/lorenz/ColorModeSelector.vitest.ts
git commit -m "feat(lorenz): add ColorModeSelector"
```

---

## Task 17: `ViewControls.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/ViewControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/ViewControls.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/ViewControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import ViewControls from './ViewControls.svelte';

const base = {
	viewMode: '3d' as const,
	autoRotate: true,
	rotationSpeed: 0.5,
	zoom: 1,
	onChange: vi.fn(),
	onResetCamera: vi.fn()
};

describe('ViewControls', () => {
	afterEach(() => cleanup());

	it('renders the projection buttons', () => {
		const { getByText } = render(ViewControls, { props: { ...base } });
		for (const label of ['3D', 'XY', 'XZ', 'YZ']) expect(getByText(label)).toBeTruthy();
	});

	it('emits a viewMode change when XY is clicked', async () => {
		const onChange = vi.fn();
		const { getByText } = render(ViewControls, { props: { ...base, onChange } });
		await fireEvent.click(getByText('XY'));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ viewMode: 'xy' }));
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/ViewControls.vitest.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/ViewControls.svelte -->
<script lang="ts">
	import type { LorenzViewMode } from '$lib/types';
	interface State {
		viewMode: LorenzViewMode;
		autoRotate: boolean;
		rotationSpeed: number;
		zoom: number;
	}
	interface Props extends State {
		onChange: (next: State) => void;
		onResetCamera: () => void;
	}
	let { viewMode, autoRotate, rotationSpeed, zoom, onChange, onResetCamera }: Props = $props();
	const modes: { value: LorenzViewMode; label: string }[] = [
		{ value: '3d', label: '3D' },
		{ value: 'xy', label: 'XY' },
		{ value: 'xz', label: 'XZ' },
		{ value: 'yz', label: 'YZ' }
	];
	function emit(patch: Partial<State>) {
		onChange({ viewMode, autoRotate, rotationSpeed, zoom, ...patch });
	}
	const modeBtn = (active: boolean) =>
		`px-3 py-1 text-xs uppercase tracking-widest font-bold rounded-sm border transition-all ${
			active
				? 'bg-primary/20 text-primary border-primary/60'
				: 'bg-primary/5 text-primary/70 border-primary/20 hover:bg-primary/10'
		}`;
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">VIEW_MODE</span>
	<div class="flex gap-2">
		{#each modes as mode (mode.value)}
			<button
				type="button"
				class={modeBtn(viewMode === mode.value)}
				onclick={() => emit({ viewMode: mode.value })}
			>
				{mode.label}
			</button>
		{/each}
	</div>
	<label class="flex items-center gap-2 text-primary/80 text-xs uppercase tracking-widest">
		<input
			type="checkbox"
			checked={autoRotate}
			onchange={(e) => emit({ autoRotate: e.currentTarget.checked })}
			class="accent-accent"
		/>
		Auto rotate
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Rotation</span>
			<span class="font-mono text-accent text-sm">{rotationSpeed.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0"
			max="3"
			step="0.1"
			value={rotationSpeed}
			oninput={(e) => emit({ rotationSpeed: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Zoom</span>
			<span class="font-mono text-accent text-sm">{zoom.toFixed(1)}x</span>
		</div>
		<input
			type="range"
			min="0.5"
			max="3"
			step="0.1"
			value={zoom}
			oninput={(e) => emit({ zoom: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
	<button
		type="button"
		onclick={onResetCamera}
		class="px-3 py-1 text-xs uppercase tracking-widest font-bold bg-primary/10 text-primary border border-primary/30 rounded-sm hover:bg-primary/20"
	>
		Reset Camera
	</button>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/ViewControls.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/ViewControls.svelte src/lib/components/visualizations/lorenz/ViewControls.vitest.ts
git commit -m "feat(lorenz): add ViewControls"
```

---

## Task 18: `SolverControls.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/SolverControls.svelte`
- Test: `src/lib/components/visualizations/lorenz/SolverControls.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/SolverControls.vitest.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/svelte';
import SolverControls from './SolverControls.svelte';

const base = {
	solver: 'rk4' as const,
	dt: 0.005,
	stepsPerFrame: 5,
	onChange: vi.fn()
};

describe('SolverControls', () => {
	afterEach(() => cleanup());

	it('renders the NUMERICAL_SOLVER title and solver select', () => {
		const { getByText, getByLabelText } = render(SolverControls, { props: { ...base } });
		expect(getByText('NUMERICAL_SOLVER')).toBeTruthy();
		expect(getByLabelText(/Solver/i)).toBeTruthy();
	});

	it('emits a solver change', async () => {
		const onChange = vi.fn();
		const { getByLabelText } = render(SolverControls, { props: { ...base, onChange } });
		await fireEvent.change(getByLabelText(/Solver/i), { target: { value: 'euler' } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ solver: 'euler' }));
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/SolverControls.vitest.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/SolverControls.svelte -->
<script lang="ts">
	import type { LorenzSolver } from '$lib/types';
	interface State {
		solver: LorenzSolver;
		dt: number;
		stepsPerFrame: number;
	}
	interface Props extends State {
		onChange: (next: State) => void;
	}
	let { solver, dt, stepsPerFrame, onChange }: Props = $props();
	function emit(patch: Partial<State>) {
		onChange({ solver, dt, stepsPerFrame, ...patch });
	}
</script>

<div class="space-y-3">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">NUMERICAL_SOLVER</span>
	<label class="space-y-1 block">
		<span class="text-primary/60 text-[10px] uppercase tracking-widest">Solver</span>
		<select
			value={solver}
			onchange={(e) => emit({ solver: e.currentTarget.value as LorenzSolver })}
			class="w-full bg-black/30 border border-primary/20 rounded-sm px-2 py-1 font-mono text-accent text-sm"
		>
			<option value="euler">Euler</option>
			<option value="rk2">RK2</option>
			<option value="rk4">RK4</option>
		</select>
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">dt</span>
			<span class="font-mono text-accent text-sm">{dt.toFixed(3)}</span>
		</div>
		<input
			type="range"
			min="0.001"
			max="0.02"
			step="0.001"
			value={dt}
			oninput={(e) => emit({ dt: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
	<label class="space-y-1 block">
		<div class="flex justify-between items-end">
			<span class="text-primary/60 text-[10px] uppercase tracking-widest">Iterations/frame</span>
			<span class="font-mono text-accent text-sm">{stepsPerFrame}</span>
		</div>
		<input
			type="range"
			min="1"
			max="50"
			step="1"
			value={stepsPerFrame}
			oninput={(e) => emit({ stepsPerFrame: Number(e.currentTarget.value) })}
			class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
		/>
	</label>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/SolverControls.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/SolverControls.svelte src/lib/components/visualizations/lorenz/SolverControls.vitest.ts
git commit -m "feat(lorenz): add SolverControls"
```

---

## Task 19: `ChaosIndicator.svelte`

**Files:**

- Create: `src/lib/components/visualizations/lorenz/ChaosIndicator.svelte`
- Test: `src/lib/components/visualizations/lorenz/ChaosIndicator.vitest.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/visualizations/lorenz/ChaosIndicator.vitest.ts
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import ChaosIndicator from './ChaosIndicator.svelte';

describe('ChaosIndicator', () => {
	afterEach(() => cleanup());

	it('shows Chaotic for a positive exponent', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: 0.9, classification: 'chaotic', diverged: false }
		});
		expect(getByText(/Chaotic/i)).toBeTruthy();
		expect(getByText(/\+0\.9/)).toBeTruthy();
	});

	it('shows Periodic / Quasi-periodic for a marginal exponent', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: 0, classification: 'marginal', diverged: false }
		});
		expect(getByText(/Periodic/i)).toBeTruthy();
	});

	it('shows Unstable when diverged', () => {
		const { getByText } = render(ChaosIndicator, {
			props: { value: NaN, classification: 'marginal', diverged: true }
		});
		expect(getByText(/Unstable|diverged/i)).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/ChaosIndicator.vitest.ts`
Expected: FAIL.

- [ ] **Step 3: Write the component**

```svelte
<!-- src/lib/components/visualizations/lorenz/ChaosIndicator.svelte -->
<script lang="ts">
	import type { LyapunovClassification } from '$lib/chua';
	interface Props {
		value: number;
		classification: LyapunovClassification;
		diverged: boolean;
	}
	let { value, classification, diverged }: Props = $props();

	const label = $derived(
		diverged
			? 'Unstable / diverged'
			: classification === 'chaotic'
				? 'Chaotic'
				: classification === 'stable'
					? 'Stable'
					: 'Periodic / Quasi-periodic'
	);
	const badgeColor = $derived(
		diverged || classification === 'chaotic'
			? 'text-accent border-accent/50'
			: classification === 'stable'
				? 'text-primary border-primary/50'
				: 'text-yellow-300 border-yellow-300/50'
	);
	const formatted = $derived(
		diverged || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
	);
</script>

<div class="flex items-center gap-3 bg-black/30 border border-primary/20 rounded-sm px-3 py-2">
	<span class="text-primary/80 text-xs uppercase tracking-widest font-bold">CHAOS_INDICATOR</span>
	<span class="font-mono text-accent text-sm">λ₁: {formatted}</span>
	<span
		class="px-2 py-0.5 text-[10px] uppercase tracking-widest font-bold rounded-sm border {badgeColor}"
	>
		{label}
	</span>
</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `bunx vitest run src/lib/components/visualizations/lorenz/ChaosIndicator.vitest.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/lib/components/visualizations/lorenz/ChaosIndicator.svelte src/lib/components/visualizations/lorenz/ChaosIndicator.vitest.ts
git commit -m "feat(lorenz): add ChaosIndicator"
```

---

# Phase 5 — Page integration

## Task 20: Wire the control suite into `src/routes/lorenz/+page.svelte`

**Files:**

- Modify (significant): `src/routes/lorenz/+page.svelte`

This adds all new `$state`, composes the control components, passes a `params` object + playback props to `LorenzRenderer`, computes λ₁ via a debounced effect, builds the full `getParameters()`, and raises the ρ slider `max` to 100.

- [ ] **Step 1: Replace the `<script>` state and helpers**

In `src/routes/lorenz/+page.svelte`, after the existing imports add:

```ts
import PresetSelector from '$lib/components/visualizations/lorenz/PresetSelector.svelte';
import InitialStateControls from '$lib/components/visualizations/lorenz/InitialStateControls.svelte';
import PlaybackControls from '$lib/components/visualizations/lorenz/PlaybackControls.svelte';
import TrailControls from '$lib/components/visualizations/lorenz/TrailControls.svelte';
import ColorModeSelector from '$lib/components/visualizations/lorenz/ColorModeSelector.svelte';
import ViewControls from '$lib/components/visualizations/lorenz/ViewControls.svelte';
import SolverControls from '$lib/components/visualizations/lorenz/SolverControls.svelte';
import ChaosIndicator from '$lib/components/visualizations/lorenz/ChaosIndicator.svelte';
import { LORENZ_DEFAULTS } from '$lib/lorenz/defaults';
import { matchPreset, type LorenzPreset } from '$lib/lorenz/presets';
import { estimateLargestLyapunov, LYAPUNOV_STEPS } from '$lib/lorenz/lyapunov';
import { useDebouncedEffect } from '$lib/use-debounced-effect';
import { DEBOUNCE_MS } from '$lib/constants';
import type { LorenzSolver, LorenzColorMode, LorenzTrailStyle, LorenzViewMode } from '$lib/types';
import type { LyapunovClassification } from '$lib/chua';
```

Replace the three existing state declarations:

```ts
let sigma = $state(10);
let rho = $state(28);
let beta = $state(8.0 / 3);
```

with the full state set:

```ts
let sigma = $state(10);
let rho = $state(28);
let beta = $state(8.0 / 3);
let x0 = $state(LORENZ_DEFAULTS.x0);
let y0 = $state(LORENZ_DEFAULTS.y0);
let z0 = $state(LORENZ_DEFAULTS.z0);
let epsilon = $state(LORENZ_DEFAULTS.epsilon);
let showGhost = $state(LORENZ_DEFAULTS.showGhost);
let solver = $state<LorenzSolver>(LORENZ_DEFAULTS.solver);
let dt = $state(LORENZ_DEFAULTS.dt);
let stepsPerFrame = $state(LORENZ_DEFAULTS.stepsPerFrame);
let speed = $state(LORENZ_DEFAULTS.speed);
let colorMode = $state<LorenzColorMode>(LORENZ_DEFAULTS.colorMode);
let trailLength = $state(LORENZ_DEFAULTS.trailLength);
let trailStyle = $state<LorenzTrailStyle>(LORENZ_DEFAULTS.trailStyle);
let viewMode = $state<LorenzViewMode>(LORENZ_DEFAULTS.viewMode);
let autoRotate = $state(LORENZ_DEFAULTS.autoRotate);
let rotationSpeed = $state(LORENZ_DEFAULTS.rotationSpeed);
let zoom = $state(LORENZ_DEFAULTS.zoom);

// Playback runtime (ephemeral, not persisted).
let isPlaying = $state(true);
let stepNonce = $state(0);
let resetNonce = $state(0);
let head = $state(0);
let diverged = $state(false);

const activePresetId = $derived(matchPreset({ sigma, rho, beta }));

// Live Lyapunov estimate (debounced; depends only on math params).
let lambda = $state(0);
let lambdaClass = $state<LyapunovClassification>('marginal');
let lambdaDiverged = $state(false);
const lyapUpdater = useDebouncedEffect(() => {
	const est = estimateLargestLyapunov({
		sigma,
		rho,
		beta,
		x0,
		y0,
		z0,
		solver: 'rk4',
		dt,
		steps: LYAPUNOV_STEPS
	});
	lambda = est.value;
	lambdaClass = est.classification;
	lambdaDiverged = est.diverged;
}, DEBOUNCE_MS);
$effect(() => {
	void sigma;
	void rho;
	void beta;
	void x0;
	void y0;
	void z0;
	void dt;
	lyapUpdater.trigger();
	return () => lyapUpdater.cleanup();
});

function applyPreset(p: LorenzPreset) {
	sigma = p.sigma;
	rho = p.rho;
	beta = p.beta;
}

function randomizeInitialState() {
	x0 = +(Math.random() * 30 - 15).toFixed(3);
	y0 = +(Math.random() * 30 - 15).toFixed(3);
	z0 = +(Math.random() * 30 - 15).toFixed(3);
}

function resetInitialState() {
	x0 = LORENZ_DEFAULTS.x0;
	y0 = LORENZ_DEFAULTS.y0;
	z0 = LORENZ_DEFAULTS.z0;
}

function resetCamera() {
	viewMode = '3d';
	zoom = 1;
	rotationSpeed = LORENZ_DEFAULTS.rotationSpeed;
}
```

Replace `getParameters()`:

```ts
function getParameters(): LorenzParameters {
	return { type: 'lorenz', sigma, rho, beta };
}
```

with:

```ts
function getParameters(): LorenzParameters {
	return {
		type: 'lorenz',
		sigma,
		rho,
		beta,
		x0,
		y0,
		z0,
		epsilon,
		showGhost,
		solver,
		dt,
		stepsPerFrame,
		speed,
		colorMode,
		trailLength,
		trailStyle,
		viewMode,
		autoRotate,
		rotationSpeed,
		zoom
	};
}
```

Update the `onParametersLoaded` callback inside the config-loader `$effect` (currently sets only sigma/rho/beta) to also load the new fields with defaults:

```ts
				onParametersLoaded: (params) => {
					sigma = params.sigma ?? sigma;
					rho = params.rho ?? rho;
					beta = params.beta ?? beta;
					x0 = params.x0 ?? x0;
					y0 = params.y0 ?? y0;
					z0 = params.z0 ?? z0;
					epsilon = params.epsilon ?? epsilon;
					showGhost = params.showGhost ?? showGhost;
					solver = params.solver ?? solver;
					dt = params.dt ?? dt;
					stepsPerFrame = params.stepsPerFrame ?? stepsPerFrame;
					speed = params.speed ?? speed;
					colorMode = params.colorMode ?? colorMode;
					trailLength = params.trailLength ?? trailLength;
					trailStyle = params.trailStyle ?? trailStyle;
					viewMode = params.viewMode ?? viewMode;
					autoRotate = params.autoRotate ?? autoRotate;
					rotationSpeed = params.rotationSpeed ?? rotationSpeed;
					zoom = params.zoom ?? zoom;
					return getParameters();
				},
```

Add an effect to keep the comparison URL effect's `void` list complete (optional) — not required for correctness.

- [ ] **Step 2: Update the markup**

Raise the ρ slider max — change the `rho` range input `max="50"` to `max="100"`.

Above the `SYSTEM_PARAMETERS` control panel `<div>`, add the preset row inside the panel (right under the `<h2>`):

```svelte
<PresetSelector activeId={activePresetId} onSelect={applyPreset} />
```

After the equations block (closing of the σ/ρ/β panel `</div>`), add a new control panel block:

```svelte
<!-- Extended Controls -->
<div
	class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden"
>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
		<InitialStateControls
			{x0}
			{y0}
			{z0}
			{epsilon}
			{showGhost}
			onChange={(s) => {
				x0 = s.x0;
				y0 = s.y0;
				z0 = s.z0;
				epsilon = s.epsilon;
				showGhost = s.showGhost;
			}}
			onRandomize={randomizeInitialState}
			onReset={resetInitialState}
		/>
		<div class="space-y-6">
			<PlaybackControls
				{isPlaying}
				{speed}
				onTogglePlay={() => (isPlaying = !isPlaying)}
				onStep={() => (stepNonce += 1)}
				onReset={() => (resetNonce += 1)}
				onSpeedChange={(s) => (speed = s)}
			/>
			<TrailControls
				{trailLength}
				{trailStyle}
				onLengthChange={(l) => (trailLength = l)}
				onStyleChange={(st) => (trailStyle = st)}
			/>
		</div>
		<ColorModeSelector {colorMode} ghostEnabled={showGhost} onChange={(m) => (colorMode = m)} />
		<ViewControls
			{viewMode}
			{autoRotate}
			{rotationSpeed}
			{zoom}
			onChange={(v) => {
				viewMode = v.viewMode;
				autoRotate = v.autoRotate;
				rotationSpeed = v.rotationSpeed;
				zoom = v.zoom;
			}}
			onResetCamera={resetCamera}
		/>
	</div>

	<details class="group/adv">
		<summary class="cursor-pointer text-primary/80 text-xs uppercase tracking-widest font-bold">
			▸ ADVANCED
		</summary>
		<div class="mt-4 max-w-md">
			<SolverControls
				{solver}
				{dt}
				{stepsPerFrame}
				onChange={(s) => {
					solver = s.solver;
					dt = s.dt;
					stepsPerFrame = s.stepsPerFrame;
				}}
			/>
		</div>
	</details>
</div>
```

Replace the `<LorenzRenderer … />` invocation:

```svelte
<LorenzRenderer
	bind:containerElement={rendererContainer}
	bind:sigma
	bind:rho
	bind:beta
	height={VIZ_CONTAINER_HEIGHT}
/>
```

with:

```svelte
<div class="space-y-2">
	<ChaosIndicator value={lambda} classification={lambdaClass} diverged={lambdaDiverged} />
	<LorenzRenderer
		bind:containerElement={rendererContainer}
		params={getParameters()}
		{isPlaying}
		{stepNonce}
		{resetNonce}
		bind:head
		bind:diverged
		height={VIZ_CONTAINER_HEIGHT}
	/>
</div>
```

- [ ] **Step 3: Type-check and run all tests**

Run: `bun run check` → Expected: PASS.
Run: `bun test` → Expected: PASS (all bun unit tests).
Run: `bunx vitest run` → Expected: PASS (all component tests).

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `bun run dev` and open `/lorenz`. Verify: presets change σ/ρ/β; ghost toggle adds a second orbit; play/pause/step/reset work; trail comet vs cumulative differ; color modes change; XY/XZ/YZ switch projection; λ₁ shows ~+0.9 for classic and a non-chaotic label for ρ=10.

- [ ] **Step 5: Commit**

```bash
bun run lint && bun run format
git add src/routes/lorenz/+page.svelte
git commit -m "feat(lorenz): wire control suite into the Lorenz page"
```

---

## Task 21: Persistence round-trip test (`comparison-url-state` + save schema)

**Files:**

- Test: `src/lib/comparison-url-state.test.ts` (add a Lorenz default case) and `src/lib/saved-config-loader.test.ts` (add an extended-config acceptance case)

> The comparison page only encodes σ/ρ/β for Lorenz, so this test confirms decode still works and that an extended saved config passes the loader's validation (the key persistence guarantee from Task 7).

- [ ] **Step 1: Add tests**

```ts
// Append to src/lib/comparison-url-state.test.ts
import { describe, expect, test } from 'bun:test';
import { getDefaultParameters } from './comparison-url-state';

describe('Lorenz comparison defaults', () => {
	test('default Lorenz parameters are the classic values', () => {
		const p = getDefaultParameters('lorenz');
		expect(p).toEqual({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 });
	});
});
```

```ts
// Append to src/lib/saved-config-loader.test.ts (mirror its existing import style)
import { describe, expect, test } from 'bun:test';
import { validateParameters } from './chaos-validation';

describe('extended Lorenz config persistence', () => {
	test('a fully-populated Lorenz config validates for saving/loading', () => {
		const result = validateParameters('lorenz', {
			type: 'lorenz',
			sigma: 10,
			rho: 28,
			beta: 8 / 3,
			solver: 'rk4',
			dt: 0.005,
			showGhost: true,
			colorMode: 'divergence',
			trailStyle: 'cumulative',
			viewMode: 'xy'
		});
		expect(result.isValid).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests**

Run: `bun test src/lib/comparison-url-state.test.ts src/lib/saved-config-loader.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/comparison-url-state.test.ts src/lib/saved-config-loader.test.ts
git commit -m "test(lorenz): persistence round-trip for extended config"
```

---

# Phase 6 — End-to-end & final verification

## Task 22: Playwright E2E for the control suite

**Files:**

- Create: `e2e/lorenz-controls.spec.ts`

> Inspect an existing spec in `e2e/` first to match the project's `baseURL`/navigation conventions (base path handling). Adjust the path prefix if the app is served under a non-root base.

- [ ] **Step 1: Write the spec**

```ts
// e2e/lorenz-controls.spec.ts
import { expect, test } from '@playwright/test';

test.describe('Lorenz control suite', () => {
	test('preset updates sigma/rho/beta sliders', async ({ page }) => {
		await page.goto('/lorenz');
		await page.getByRole('button', { name: 'High Energy' }).click();
		const rho = page.locator('#rho');
		await expect(rho).toHaveValue('40');
	});

	test('playback Pause toggles to Play', async ({ page }) => {
		await page.goto('/lorenz');
		await page.getByRole('button', { name: 'Pause' }).click();
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	});

	test('switching to XY projection keeps the canvas mounted', async ({ page }) => {
		await page.goto('/lorenz');
		await page.getByRole('button', { name: 'XY', exact: true }).click();
		await expect(page.locator('canvas')).toBeVisible();
	});

	test('a shared URL with extended params loads the controls', async ({ page }) => {
		await page.goto(
			'/lorenz?sigma=10&rho=28&beta=2.667&solver=euler&showGhost=true&colorMode=zheight'
		);
		await expect(page.locator('#rho')).toHaveValue('28');
	});
});
```

- [ ] **Step 2: Run E2E**

Run: `bun run test:e2e e2e/lorenz-controls.spec.ts`
Expected: PASS. If the URL-param test fails, confirm `useConfigLoader` reads `solver`/`showGhost`/`colorMode` from the query string; the main-page loader change in Task 20 plus the loader's existing query parsing should cover it. If the loader only parses numeric params, extend it to parse the typed fields (string/boolean) — see NOTE below.

> NOTE: `useConfigLoader` historically parses numeric query params. If the E2E URL-param assertion shows the typed fields are ignored, add parsing for `solver` (string enum), `showGhost`/`autoRotate` (`'true'`/`'false'`), `colorMode`/`trailStyle`/`viewMode` (string enums) in `src/lib/use-config-loader.ts`, validating against the same enums used in `OPTIONAL_FIELDS`. Keep numeric parsing for `x0,y0,z0,epsilon,dt,stepsPerFrame,speed,trailLength,rotationSpeed,zoom`. The minimal assertion above (ρ value) passes regardless; the typed-field parsing is only needed for full URL reproducibility.

- [ ] **Step 3: Commit**

```bash
git add e2e/lorenz-controls.spec.ts
git commit -m "test(lorenz): e2e for control suite"
```

---

## Task 23: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run the complete suite**

```bash
bun run check
bun run lint
bun test
bunx vitest run
bun run test:e2e
bun run build
```

Expected: all green; production build succeeds.

- [ ] **Step 2: Manual cross-check against the spec**

Open `/lorenz` and confirm each of the 8 feature groups works; open `/lorenz/compare` and confirm it still renders both sides statically with camera sync (unchanged behavior); save a config, reload via `/saved-configs`, and confirm the extended settings are restored; share a config and open the share link.

- [ ] **Step 3: Final commit (if any formatting changed)**

```bash
git add -A
git commit -m "chore(lorenz): final verification sweep" || echo "nothing to commit"
```

---

## Self-review notes (addressed in this plan)

- **Spec coverage:** all 8 feature groups map to tasks — initial state + ghost (Task 13, renderer Task 10), trail comet/cumulative (Tasks 9/15/10), playback (Tasks 14/10), solver/dt (Tasks 1/18), color modes (Tasks 4/16/10), view/projection (Tasks 17/10), presets (Tasks 3/12), Lyapunov indicator (Tasks 5/19/20). Persistence (Tasks 6/7/20/21). Validation/edge cases (Task 7). Testing (every task + Tasks 21/22/23).
- **Discovered gap (now covered):** the shared `validateParameters` would reject extended Lorenz configs; Task 7 teaches it Lorenz's optional typed fields while keeping σ/ρ/β the only required keys (backward compatible).
- **Renderer prop shape:** the spec's "single params object" is honored — the renderer takes `params: LorenzParameters` (resolved internally), not 20 props. The compare page is updated to pass a `params` object (mechanical, no UI change).
- **Type consistency:** shared identifiers are listed once at the top and used verbatim throughout.
