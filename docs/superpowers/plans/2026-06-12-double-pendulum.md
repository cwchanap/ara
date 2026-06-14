# Double Pendulum Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully-integrated `Double Pendulum` visualization module — a real-time, deterministic, client-side RK4 physics simulation with a fading trail, an in-canvas divergence-comparison overlay, and a side-by-side `/compare` route.

**Architecture:** A pure, unit-tested physics module (`double-pendulum.ts`, mirroring `chua.ts`) provides RK4 integration and helpers. A Canvas-2D renderer component (`DoublePendulumRenderer.svelte`) owns the `requestAnimationFrame` loop, evolving state, trail, and comparison overlay. The main page (modeled on `src/routes/ikeda/+page.svelte`) wires controls + save/share/snapshot + URL loading. The module is registered across the shared type/validation/comparison files exactly like every existing module.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), Canvas 2D, Vitest (node + jsdom), Playwright. Package manager / runner: `bun`.

**Key conventions discovered (do not deviate):**

- Physics modules are pure `.ts` in `src/lib/` with node tests (`*.test.ts`). Renderers are `.svelte` in `src/lib/components/visualizations/` with jsdom tests (`*.svelte.test.ts`).
- Adding a fully-integrated map type touches these five non-test files: `src/lib/types.ts`, `src/lib/chaos-validation.ts`, `src/lib/type-guards.ts`, `src/lib/comparison-url-state.ts`, `src/routes/+page.svelte`.
- `src/lib/saved-config-loader.ts`, `src/routes/api/save-config/+server.ts`, and the DB schema (`map_type` is a plain `text` column, no enum/CHECK) are all **generic** — no per-type edits needed.
- The Web Worker files (`src/lib/workers/*`) are **only** for heavy point-compute maps. The double pendulum runs its own rAF loop in the renderer. **Do not touch the worker files.**
- The angle convention used throughout: `theta` is measured from the downward vertical, in radians. Math coordinates use y pointing **down** (matches Canvas), pivot at the origin.

---

## File Structure

**New files:**

- `src/lib/double-pendulum.ts` — pure physics: types, `derivatives`, `rk4Step`, `bobPositions`, `divergence`, `randomizeInitialConditions`, `isFiniteState`.
- `src/lib/double-pendulum.test.ts` — node tests for the physics module.
- `src/lib/double-pendulum-presets.ts` — `DoublePendulumState` type, presets array, default id, `getPreset`, `detectPresetId`.
- `src/lib/double-pendulum-presets.test.ts` — node tests for presets.
- `src/lib/components/visualizations/DoublePendulumRenderer.svelte` — Canvas-2D renderer + rAF loop + trail + comparison overlay.
- `src/lib/components/visualizations/DoublePendulumRenderer.svelte.test.ts` — jsdom mount/behavior tests.
- `src/routes/double-pendulum/+page.svelte` — main module page.
- `src/routes/double-pendulum/compare/+page.svelte` — side-by-side compare route.
- `e2e/double-pendulum.spec.ts` — Playwright E2E.

**Modified files:**

- `src/lib/types.ts` — register the type.
- `src/lib/chaos-validation.ts` — ranges, optional fields, stability case.
- `src/lib/type-guards.ts` — `isDoublePendulumParameters`.
- `src/lib/comparison-url-state.ts` — default-parameters case.
- `src/routes/+page.svelte` — homepage card.
- `src/lib/types.test.ts`, `src/lib/chaos-validation.test.ts`, `src/lib/type-guards.test.ts`, `src/routes/page.svelte.test.ts`, `src/routes/visualization-pages.svelte.test.ts` — extend enumerating tests.

---

## Task 1: Physics module

**Files:**

- Create: `src/lib/double-pendulum.ts`
- Test: `src/lib/double-pendulum.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/double-pendulum.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	derivatives,
	rk4Step,
	bobPositions,
	divergence,
	randomizeInitialConditions,
	isFiniteState,
	type PendulumState,
	type PendulumPhysics
} from './double-pendulum';

const PHYS: PendulumPhysics = { l1: 1, l2: 1, m1: 1, m2: 1, gravity: 9.81, damping: 0 };

function totalEnergy(s: PendulumState, p: PendulumPhysics): number {
	// Kinetic + potential energy of a double pendulum (y measured downward,
	// so potential energy uses -cos(theta) relative to the pivot).
	const { l1, l2, m1, m2, gravity: g } = p;
	const v1sq = l1 * l1 * s.omega1 * s.omega1;
	const v2sq =
		l1 * l1 * s.omega1 * s.omega1 +
		l2 * l2 * s.omega2 * s.omega2 +
		2 * l1 * l2 * s.omega1 * s.omega2 * Math.cos(s.theta1 - s.theta2);
	const ke = 0.5 * m1 * v1sq + 0.5 * m2 * v2sq;
	const y1 = -l1 * Math.cos(s.theta1);
	const y2 = -l1 * Math.cos(s.theta1) - l2 * Math.cos(s.theta2);
	const pe = m1 * g * y1 + m2 * g * y2;
	return ke + pe;
}

describe('derivatives', () => {
	it('returns zero angular acceleration at stable rest (hanging straight down)', () => {
		const d = derivatives({ theta1: 0, theta2: 0, omega1: 0, omega2: 0 }, PHYS);
		expect(d.dTheta1).toBe(0);
		expect(d.dTheta2).toBe(0);
		expect(Math.abs(d.dOmega1)).toBeLessThan(1e-9);
		expect(Math.abs(d.dOmega2)).toBeLessThan(1e-9);
	});

	it('feeds omega into dTheta', () => {
		const d = derivatives({ theta1: 0.3, theta2: -0.2, omega1: 1.5, omega2: -0.7 }, PHYS);
		expect(d.dTheta1).toBe(1.5);
		expect(d.dTheta2).toBe(-0.7);
	});

	it('applies viscous damping to angular acceleration', () => {
		const damped: PendulumPhysics = { ...PHYS, damping: 0.5 };
		const s: PendulumState = { theta1: 0, theta2: 0, omega1: 2, omega2: 2 };
		const undampedD = derivatives(s, PHYS);
		const dampedD = derivatives(s, damped);
		expect(dampedD.dOmega1).toBeCloseTo(undampedD.dOmega1 - 0.5 * 2, 9);
		expect(dampedD.dOmega2).toBeCloseTo(undampedD.dOmega2 - 0.5 * 2, 9);
	});
});

describe('rk4Step', () => {
	it('keeps a pendulum at rest at rest', () => {
		const s: PendulumState = { theta1: 0, theta2: 0, omega1: 0, omega2: 0 };
		const next = rk4Step(s, PHYS, 0.01);
		expect(next.theta1).toBeCloseTo(0, 9);
		expect(next.theta2).toBeCloseTo(0, 9);
		expect(next.omega1).toBeCloseTo(0, 9);
		expect(next.omega2).toBeCloseTo(0, 9);
	});

	it('approximately conserves energy with damping = 0 over many steps', () => {
		// Use a non-degenerate start: at theta1=theta2=PI/2 the total energy is
		// exactly 0, which makes a *relative* tolerance check meaningless.
		let s: PendulumState = { theta1: 1, theta2: 0.5, omega1: 0, omega2: 0 };
		const e0 = totalEnergy(s, PHYS);
		for (let i = 0; i < 2000; i++) s = rk4Step(s, PHYS, 0.005);
		const e1 = totalEnergy(s, PHYS);
		expect(Math.abs(e1 - e0)).toBeLessThan(0.05 * Math.abs(e0));
	});

	it('produces finite output for an energetic start', () => {
		let s: PendulumState = { theta1: 3, theta2: -3, omega1: 5, omega2: -5 };
		for (let i = 0; i < 500; i++) s = rk4Step(s, PHYS, 0.005);
		expect(isFiniteState(s)).toBe(true);
	});
});

describe('bobPositions', () => {
	it('hangs straight down at theta = 0 (y positive downward)', () => {
		const pos = bobPositions({ theta1: 0, theta2: 0, omega1: 0, omega2: 0 }, PHYS);
		expect(pos.x1).toBeCloseTo(0, 9);
		expect(pos.y1).toBeCloseTo(1, 9);
		expect(pos.x2).toBeCloseTo(0, 9);
		expect(pos.y2).toBeCloseTo(2, 9);
	});

	it('points horizontally at theta = PI/2', () => {
		const pos = bobPositions(
			{ theta1: Math.PI / 2, theta2: Math.PI / 2, omega1: 0, omega2: 0 },
			PHYS
		);
		expect(pos.x1).toBeCloseTo(1, 9);
		expect(pos.y1).toBeCloseTo(0, 9);
		expect(pos.x2).toBeCloseTo(2, 9);
		expect(pos.y2).toBeCloseTo(0, 9);
	});
});

describe('divergence', () => {
	it('is zero for identical states', () => {
		const s: PendulumState = { theta1: 1, theta2: 0.5, omega1: 0, omega2: 0 };
		expect(divergence(s, s, PHYS)).toBe(0);
	});

	it('is positive and symmetric for differing states', () => {
		const a: PendulumState = { theta1: 1, theta2: 0.5, omega1: 0, omega2: 0 };
		const b: PendulumState = { theta1: 1.1, theta2: 0.5, omega1: 0, omega2: 0 };
		expect(divergence(a, b, PHYS)).toBeGreaterThan(0);
		expect(divergence(a, b, PHYS)).toBeCloseTo(divergence(b, a, PHYS), 12);
	});
});

describe('randomizeInitialConditions', () => {
	it('returns angles in [-PI, PI] and zero velocities using an injected RNG', () => {
		const ic = randomizeInitialConditions(() => 0.75);
		expect(ic.theta1).toBeCloseTo(Math.PI * 0.5, 9); // (0.75*2 - 1) * PI = 0.5*PI
		expect(ic.theta2).toBeCloseTo(Math.PI * 0.5, 9);
		expect(ic.omega1).toBe(0);
		expect(ic.omega2).toBe(0);
	});
});

describe('isFiniteState', () => {
	it('rejects NaN and Infinity', () => {
		expect(isFiniteState({ theta1: NaN, theta2: 0, omega1: 0, omega2: 0 })).toBe(false);
		expect(isFiniteState({ theta1: 0, theta2: 0, omega1: Infinity, omega2: 0 })).toBe(false);
		expect(isFiniteState({ theta1: 0, theta2: 0, omega1: 0, omega2: 0 })).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/double-pendulum.test.ts`
Expected: FAIL — module `./double-pendulum` cannot be resolved.

- [ ] **Step 3: Implement the physics module**

Create `src/lib/double-pendulum.ts`:

```ts
/**
 * Double Pendulum Physics
 *
 * Two point masses on massless rigid rods, pivot fixed at the origin.
 * Angles `theta1`/`theta2` are measured from the downward vertical (radians);
 * y points downward so positions map directly to canvas coordinates.
 *
 * Equations of motion follow the standard formulation (e.g. myphysicslab),
 * with an added linear viscous damping term `-damping * omega` on each angular
 * acceleration. Integrated with classic fourth-order Runge–Kutta.
 */

export interface PendulumState {
	theta1: number;
	theta2: number;
	omega1: number;
	omega2: number;
}

export interface PendulumPhysics {
	l1: number;
	l2: number;
	m1: number;
	m2: number;
	gravity: number;
	damping: number;
}

export interface PendulumDerivatives {
	dTheta1: number;
	dTheta2: number;
	dOmega1: number;
	dOmega2: number;
}

export interface BobPositions {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

/** Compute the time-derivatives of the state under the given physics. */
export function derivatives(s: PendulumState, p: PendulumPhysics): PendulumDerivatives {
	const { theta1, theta2, omega1, omega2 } = s;
	const { l1, l2, m1, m2, gravity: g, damping } = p;

	const delta = theta1 - theta2;
	const denom = 2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2);

	const dOmega1 =
		(-g * (2 * m1 + m2) * Math.sin(theta1) -
			m2 * g * Math.sin(theta1 - 2 * theta2) -
			2 * Math.sin(delta) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(delta))) /
			(l1 * denom) -
		damping * omega1;

	const dOmega2 =
		(2 *
			Math.sin(delta) *
			(omega1 * omega1 * l1 * (m1 + m2) +
				g * (m1 + m2) * Math.cos(theta1) +
				omega2 * omega2 * l2 * m2 * Math.cos(delta))) /
			(l2 * denom) -
		damping * omega2;

	return { dTheta1: omega1, dTheta2: omega2, dOmega1, dOmega2 };
}

function addScaled(s: PendulumState, d: PendulumDerivatives, h: number): PendulumState {
	return {
		theta1: s.theta1 + h * d.dTheta1,
		theta2: s.theta2 + h * d.dTheta2,
		omega1: s.omega1 + h * d.dOmega1,
		omega2: s.omega2 + h * d.dOmega2
	};
}

/** Advance one fourth-order Runge–Kutta step. Pure: returns a new state. */
export function rk4Step(s: PendulumState, p: PendulumPhysics, dt: number): PendulumState {
	const k1 = derivatives(s, p);
	const k2 = derivatives(addScaled(s, k1, dt / 2), p);
	const k3 = derivatives(addScaled(s, k2, dt / 2), p);
	const k4 = derivatives(addScaled(s, k3, dt), p);
	return {
		theta1: s.theta1 + (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1),
		theta2: s.theta2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2),
		omega1: s.omega1 + (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1),
		omega2: s.omega2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2)
	};
}

/** Cartesian positions of both bobs, pivot at the origin, y pointing downward. */
export function bobPositions(s: PendulumState, p: PendulumPhysics): BobPositions {
	const x1 = p.l1 * Math.sin(s.theta1);
	const y1 = p.l1 * Math.cos(s.theta1);
	const x2 = x1 + p.l2 * Math.sin(s.theta2);
	const y2 = y1 + p.l2 * Math.cos(s.theta2);
	return { x1, y1, x2, y2 };
}

/** Euclidean distance between the second bobs of two systems sharing physics `p`. */
export function divergence(a: PendulumState, b: PendulumState, p: PendulumPhysics): number {
	const pa = bobPositions(a, p);
	const pb = bobPositions(b, p);
	return Math.hypot(pa.x2 - pb.x2, pa.y2 - pb.y2);
}

/** Fresh initial conditions: angles uniform in [-PI, PI], zero velocity. RNG injectable. */
export function randomizeInitialConditions(rng: () => number = Math.random): PendulumState {
	return {
		theta1: (rng() * 2 - 1) * Math.PI,
		theta2: (rng() * 2 - 1) * Math.PI,
		omega1: 0,
		omega2: 0
	};
}

/** True when every field is finite (used to detect NaN/Infinity blow-up). */
export function isFiniteState(s: PendulumState): boolean {
	return (
		Number.isFinite(s.theta1) &&
		Number.isFinite(s.theta2) &&
		Number.isFinite(s.omega1) &&
		Number.isFinite(s.omega2)
	);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/double-pendulum.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/double-pendulum.ts src/lib/double-pendulum.test.ts
git commit -m "feat: add double pendulum physics module (HPA-56)"
```

---

## Task 2: Presets & defaults

**Files:**

- Create: `src/lib/double-pendulum-presets.ts`
- Test: `src/lib/double-pendulum-presets.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/double-pendulum-presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
	DOUBLE_PENDULUM_PRESETS,
	DEFAULT_DOUBLE_PENDULUM_PRESET_ID,
	getPreset,
	detectPresetId,
	type DoublePendulumState
} from './double-pendulum-presets';

describe('double pendulum presets', () => {
	it('exposes a non-empty preset list with a valid default id', () => {
		expect(DOUBLE_PENDULUM_PRESETS.length).toBeGreaterThan(0);
		expect(getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID)).toBeDefined();
	});

	it('getPreset returns undefined for an unknown id', () => {
		expect(getPreset('nope')).toBeUndefined();
	});

	it('every preset has all required physical fields', () => {
		for (const preset of DOUBLE_PENDULUM_PRESETS) {
			const s = preset.state;
			for (const key of [
				'theta1',
				'theta2',
				'omega1',
				'omega2',
				'l1',
				'l2',
				'm1',
				'm2',
				'gravity',
				'damping'
			] as const) {
				expect(typeof s[key]).toBe('number');
			}
			expect(s.l1).toBeGreaterThan(0);
			expect(s.l2).toBeGreaterThan(0);
			expect(s.m1).toBeGreaterThan(0);
			expect(s.m2).toBeGreaterThan(0);
		}
	});

	it('detectPresetId round-trips a preset state', () => {
		const def = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
		expect(def).toBeDefined();
		expect(detectPresetId(def!.state)).toBe(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	});

	it('detectPresetId returns null for a custom state', () => {
		const def = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID)!;
		const custom: DoublePendulumState = { ...def.state, gravity: def.state.gravity + 3.3 };
		expect(detectPresetId(custom)).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/double-pendulum-presets.test.ts`
Expected: FAIL — module cannot be resolved.

- [ ] **Step 3: Implement the presets module**

Create `src/lib/double-pendulum-presets.ts`:

```ts
/** Full set of user-controllable double pendulum state (everything that is persisted). */
export interface DoublePendulumState {
	theta1: number;
	theta2: number;
	omega1: number;
	omega2: number;
	l1: number;
	l2: number;
	m1: number;
	m2: number;
	gravity: number;
	damping: number;
	speed: number;
	showTrail: boolean;
	trailLength: number;
	compareMode: boolean;
	compareOffset: number;
}

export interface DoublePendulumPreset {
	id: string;
	label: string;
	state: DoublePendulumState;
}

const BASE: Omit<DoublePendulumState, 'theta1' | 'theta2' | 'm1' | 'm2' | 'damping'> = {
	omega1: 0,
	omega2: 0,
	l1: 1,
	l2: 1,
	gravity: 9.81,
	speed: 1,
	showTrail: true,
	trailLength: 400,
	compareMode: false,
	compareOffset: 0.001
};

export const DOUBLE_PENDULUM_PRESETS: DoublePendulumPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: { ...BASE, theta1: Math.PI / 2, theta2: Math.PI / 2, m1: 1, m2: 1, damping: 0 }
	},
	{
		id: 'near-vertical',
		label: 'Near Vertical',
		state: { ...BASE, theta1: Math.PI * 0.99, theta2: Math.PI * 0.99, m1: 1, m2: 1, damping: 0 }
	},
	{
		id: 'asymmetric',
		label: 'Asymmetric',
		state: { ...BASE, theta1: Math.PI / 2, theta2: Math.PI, m1: 2, m2: 1, damping: 0 }
	},
	{
		id: 'damped',
		label: 'Damped',
		state: { ...BASE, theta1: Math.PI / 2, theta2: Math.PI / 2, m1: 1, m2: 1, damping: 0.1 }
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_DOUBLE_PENDULUM_PRESET_ID = 'classic';

export function getPreset(id: string): DoublePendulumPreset | undefined {
	return DOUBLE_PENDULUM_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/** Id of the preset whose state matches exactly, or null ("Custom"). */
export function detectPresetId(state: DoublePendulumState): string | null {
	for (const preset of DOUBLE_PENDULUM_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.theta1, state.theta1) &&
			numbersClose(s.theta2, state.theta2) &&
			numbersClose(s.omega1, state.omega1) &&
			numbersClose(s.omega2, state.omega2) &&
			numbersClose(s.l1, state.l1) &&
			numbersClose(s.l2, state.l2) &&
			numbersClose(s.m1, state.m1) &&
			numbersClose(s.m2, state.m2) &&
			numbersClose(s.gravity, state.gravity) &&
			numbersClose(s.damping, state.damping) &&
			numbersClose(s.speed, state.speed) &&
			s.showTrail === state.showTrail &&
			s.trailLength === state.trailLength &&
			s.compareMode === state.compareMode &&
			numbersClose(s.compareOffset, state.compareOffset)
		) {
			return preset.id;
		}
	}
	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/double-pendulum-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/double-pendulum-presets.ts src/lib/double-pendulum-presets.test.ts
git commit -m "feat: add double pendulum presets and defaults (HPA-56)"
```

---

## Task 3: Register the type in `types.ts`

**Files:**

- Modify: `src/lib/types.ts`
- Test: `src/lib/types.test.ts`

- [ ] **Step 1: Add the type to the union**

In `src/lib/types.ts`, change the `ChaosMapType` union (ends with `| 'chua';`) to add the new member:

```ts
export type ChaosMapType =
	| 'lorenz'
	| 'rossler'
	| 'henon'
	| 'lozi'
	| 'ikeda'
	| 'logistic'
	| 'newton'
	| 'standard'
	| 'bifurcation-logistic'
	| 'bifurcation-henon'
	| 'chaos-esthetique'
	| 'lyapunov'
	| 'chua'
	| 'double-pendulum';
```

- [ ] **Step 2: Add the parameters interface**

In `src/lib/types.ts`, immediately after the `ChuaParameters` interface (the one ending at the `}` before `// Union type for all chaos map parameters`), add:

```ts
/**
 * Double Pendulum parameters (persisted/saved/shared).
 *
 * theta/omega are the INITIAL conditions only (the live evolving state is
 * session-local and not persisted — same approach as Chua). The optional
 * fields capture sim/render settings so save/share/snapshot reproduce a setup.
 */
export interface DoublePendulumParameters {
	type: 'double-pendulum';
	// Initial conditions (radians, rad/s)
	theta1: number;
	theta2: number;
	omega1: number;
	omega2: number;
	// Physical parameters
	l1: number;
	l2: number;
	m1: number;
	m2: number;
	gravity: number;
	damping: number;
	// Optional sim/render state
	speed?: number;
	showTrail?: boolean;
	trailLength?: number;
	compareMode?: boolean;
	compareOffset?: number;
}
```

- [ ] **Step 3: Add to the `ChaosMapParameters` union**

In `src/lib/types.ts`, in `export type ChaosMapParameters =`, add the new member after `| ChuaParameters`:

```ts
	| ChuaParameters
	| DoublePendulumParameters;
```

- [ ] **Step 4: Add display name and valid-types entry**

In `CHAOS_MAP_DISPLAY_NAMES`, after `chua: 'CHUA_CIRCUIT'` add (insert a comma after the chua line):

```ts
	chua: 'CHUA_CIRCUIT',
	'double-pendulum': 'DOUBLE_PENDULUM'
```

In `VALID_MAP_TYPES`, after `'chua'` add (insert a comma after `'chua'`):

```ts
('chua', 'double-pendulum');
```

- [ ] **Step 5: Add to the `SavedConfiguration` union**

In `src/lib/types.ts`, in the `SavedConfiguration` discriminated union, after the chua block add:

```ts
		| {
				mapType: 'chua';
				parameters: ChuaParameters;
		  }
		| {
				mapType: 'double-pendulum';
				parameters: DoublePendulumParameters;
		  }
```

- [ ] **Step 6: Extend the types test**

Open `src/lib/types.test.ts`. Find every assertion that enumerates all map types or asserts a count of 13 and update it to include `'double-pendulum'` / count 14. Concretely: add `'double-pendulum'` to any expected `VALID_MAP_TYPES` array, add `'double-pendulum': 'DOUBLE_PENDULUM'` to any expected display-names object, and change any `toHaveLength(13)` / `.toBe(13)` for map types to `14`. Run the file to see exactly which assertions fail and fix each:

Run: `bun run vitest run src/lib/types.test.ts`
Expected after edits: PASS.

- [ ] **Step 7: Type-check**

Run: `bun run check`
Expected: no new errors. (Existing `switch`/guard exhaustiveness errors, if any surface, are fixed in Tasks 4–5.)

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat: register double-pendulum map type (HPA-56)"
```

---

## Task 4: Validation integration

**Files:**

- Modify: `src/lib/chaos-validation.ts`
- Test: `src/lib/chaos-validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Append to `src/lib/chaos-validation.test.ts` (inside the existing top-level `describe`, or as a new `describe` block at the end of the file):

```ts
describe('double-pendulum validation', () => {
	const valid = {
		type: 'double-pendulum',
		theta1: Math.PI / 2,
		theta2: Math.PI / 2,
		omega1: 0,
		omega2: 0,
		l1: 1,
		l2: 1,
		m1: 1,
		m2: 1,
		gravity: 9.81,
		damping: 0
	};

	it('accepts a complete valid parameter set', () => {
		const result = validateParameters('double-pendulum', valid);
		expect(result.isValid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it('reports missing required parameters', () => {
		const { gravity, ...incomplete } = valid;
		void gravity;
		const result = validateParameters('double-pendulum', incomplete);
		expect(result.isValid).toBe(false);
		expect(result.errors.join(' ')).toContain('gravity');
	});

	it('accepts optional sim/render fields and clamps out-of-range trailLength', () => {
		const result = validateParameters('double-pendulum', {
			...valid,
			speed: 1,
			showTrail: true,
			trailLength: 999999,
			compareMode: false,
			compareOffset: 0.001
		});
		expect(result.isValid).toBe(true);
		expect((result.parameters as Record<string, number>).trailLength).toBe(5000);
	});

	it('warns when gravity is zero (pendulum will not swing)', () => {
		const result = checkParameterStability('double-pendulum', { ...valid, gravity: 0 });
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toContain('gravity');
	});

	it('is stable for default chaotic parameters', () => {
		const result = checkParameterStability('double-pendulum', valid);
		expect(result.isStable).toBe(true);
	});

	it('exposes stable ranges and recognizes the map type', () => {
		expect(getStableRanges('double-pendulum')).toBeDefined();
		expect(isValidMapType('double-pendulum')).toBe(true);
	});
});
```

Make sure `validateParameters`, `checkParameterStability`, `getStableRanges`, and `isValidMapType` are imported at the top of the test file (they already are for existing tests — add any that are missing).

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/chaos-validation.test.ts -t "double-pendulum"`
Expected: FAIL — `Unknown map type: double-pendulum` (ranges not registered yet).

- [ ] **Step 3: Add stable ranges**

In `src/lib/chaos-validation.ts`, in the `STABLE_RANGES` object, after the `chua: { ... }` block add (insert a comma after the chua block's closing brace):

```ts
	chua: {
		alpha: { min: 8, max: 20 },
		beta: { min: 20, max: 53 },
		gamma: { min: -1, max: 1 },
		a: { min: -2, max: -0.5 },
		b: { min: -1.5, max: -0.3 }
	},
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
	}
```

- [ ] **Step 4: Add optional fields**

In `src/lib/chaos-validation.ts`, in the `OPTIONAL_FIELDS` object, after the `ikeda: { ... }` block add (insert a comma after the ikeda block's closing brace):

```ts
	ikeda: {
		renderMode: { kind: 'enum', values: ['single', 'multi'] },
		seeds: { kind: 'number', min: 1, max: 5000 },
		colorMode: { kind: 'enum', values: ['single', 'iteration', 'seed', 'radius'] },
		pointSize: { kind: 'number', min: 0.5, max: 6 },
		opacity: { kind: 'number', min: 0, max: 1 }
	},
	'double-pendulum': {
		speed: { kind: 'number', min: 0, max: 10 },
		showTrail: { kind: 'boolean' },
		trailLength: { kind: 'number', min: 1, max: 5000 },
		compareMode: { kind: 'boolean' },
		compareOffset: { kind: 'number', min: -1, max: 1 }
	}
```

- [ ] **Step 5: Add the stability switch case**

In `src/lib/chaos-validation.ts`, inside `checkParameterStability`, in the `switch (mapType)` block, add a case before the closing `}` of the switch:

```ts
		case 'double-pendulum':
			if (paramRecord.gravity === 0) {
				warnings.push('gravity is 0; the pendulum will not swing');
			}
			break;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun run vitest run src/lib/chaos-validation.test.ts`
Expected: PASS (the whole file, including the new block).

- [ ] **Step 7: Commit**

```bash
git add src/lib/chaos-validation.ts src/lib/chaos-validation.test.ts
git commit -m "feat: add double-pendulum parameter validation (HPA-56)"
```

---

## Task 5: Type guard & comparison-url default

**Files:**

- Modify: `src/lib/type-guards.ts`
- Modify: `src/lib/comparison-url-state.ts`
- Test: `src/lib/type-guards.test.ts`

- [ ] **Step 1: Write the failing type-guard test**

Append to `src/lib/type-guards.test.ts` (within the existing describe or as a new block). Also add `isDoublePendulumParameters` to the import from `./type-guards` and `DoublePendulumParameters` to the type import from `$lib/types` at the top of the test file:

```ts
describe('isDoublePendulumParameters', () => {
	it('returns true only for double-pendulum params', () => {
		const params: DoublePendulumParameters = {
			type: 'double-pendulum',
			theta1: 1,
			theta2: 1,
			omega1: 0,
			omega2: 0,
			l1: 1,
			l2: 1,
			m1: 1,
			m2: 1,
			gravity: 9.81,
			damping: 0
		};
		expect(isDoublePendulumParameters(params)).toBe(true);
		expect(isDoublePendulumParameters({ type: 'chua' } as never)).toBe(false);
		expect(isDoublePendulumParameters(null)).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/type-guards.test.ts -t "isDoublePendulumParameters"`
Expected: FAIL — `isDoublePendulumParameters` is not exported.

- [ ] **Step 3: Add the type guard**

In `src/lib/type-guards.ts`, add `DoublePendulumParameters` to the type import list at the top, then append before the generic `isParametersOfType` function:

```ts
/**
 * Type guard for Double Pendulum parameters.
 */
export function isDoublePendulumParameters(
	params: ChaosMapParameters | null | undefined
): params is DoublePendulumParameters {
	return params?.type === 'double-pendulum';
}
```

- [ ] **Step 4: Add the comparison-url default-parameters case**

In `src/lib/comparison-url-state.ts`, add an import near the existing ikeda-presets import at the top:

```ts
import {
	getPreset as getDoublePendulumPreset,
	DEFAULT_DOUBLE_PENDULUM_PRESET_ID
} from './double-pendulum-presets';
```

Then, in the `getDefaultParameters` function's `switch`, add a case alongside the others (e.g. after the `chua` case):

```ts
		case 'double-pendulum': {
			const preset = getDoublePendulumPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
			if (!preset) {
				throw new Error(
					`Missing default double-pendulum preset: ${DEFAULT_DOUBLE_PENDULUM_PRESET_ID}`
				);
			}
			return { type: 'double-pendulum', ...preset.state };
		}
```

(If `getDefaultParameters` has an exhaustive `switch` with a default branch or a return after it, ensure this case sits before any `default`. Run `bun run check` to confirm exhaustiveness is satisfied.)

- [ ] **Step 5: Run tests + type-check to verify they pass**

Run: `bun run vitest run src/lib/type-guards.test.ts && bun run check`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/type-guards.ts src/lib/type-guards.test.ts src/lib/comparison-url-state.ts
git commit -m "feat: add double-pendulum type guard and comparison default (HPA-56)"
```

---

## Task 6: Renderer component

**Files:**

- Create: `src/lib/components/visualizations/DoublePendulumRenderer.svelte`
- Test: `src/lib/components/visualizations/DoublePendulumRenderer.svelte.test.ts`

- [ ] **Step 1: Write the failing component test**

Create `src/lib/components/visualizations/DoublePendulumRenderer.svelte.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DoublePendulumRenderer from './DoublePendulumRenderer.svelte';

// jsdom has no real rAF/canvas timing; stub a deterministic frame pump.
beforeEach(() => {
	let id = 0;
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		id += 1;
		// Do not auto-run forever; tests advance frames manually where needed.
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const baseProps = {
	theta1: Math.PI / 2,
	theta2: Math.PI / 2,
	omega1: 0,
	omega2: 0,
	l1: 1,
	l2: 1,
	m1: 1,
	m2: 1,
	gravity: 9.81,
	damping: 0,
	height: 400
};

describe('DoublePendulumRenderer', () => {
	it('mounts and renders a canvas', () => {
		const { container } = render(DoublePendulumRenderer, { props: baseProps });
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('renders the renderer label', () => {
		const { getByText } = render(DoublePendulumRenderer, { props: baseProps });
		expect(getByText('DOUBLE_PENDULUM_RENDERER')).toBeTruthy();
	});

	it('shows a divergence readout element when comparison mode is on', () => {
		const { getByTestId } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: true, compareOffset: 0.001 }
		});
		expect(getByTestId('divergence-readout')).toBeTruthy();
	});

	it('does not show the divergence readout when comparison mode is off', () => {
		const { queryByTestId } = render(DoublePendulumRenderer, {
			props: { ...baseProps, compareMode: false }
		});
		expect(queryByTestId('divergence-readout')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/lib/components/visualizations/DoublePendulumRenderer.svelte.test.ts`
Expected: FAIL — component file does not exist.

- [ ] **Step 3: Implement the renderer**

Create `src/lib/components/visualizations/DoublePendulumRenderer.svelte`:

```svelte
<!--
  DoublePendulumRenderer Component

  Canvas-2D real-time double pendulum. Owns the requestAnimationFrame loop,
  the evolving physics state, a capped fading trail, and an optional in-canvas
  comparison overlay (a second pendulum seeded with a tiny angle offset) plus a
  live divergence readout.

  Parameter philosophy:
  - Initial conditions (theta/omega) + restartSignal + compareMode/compareOffset
    re-seed the live simulation and clear trails.
  - Physical parameters (l, m, gravity, damping) apply live without re-seeding.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		rk4Step,
		bobPositions,
		divergence,
		isFiniteState,
		type PendulumState,
		type PendulumPhysics
	} from '$lib/double-pendulum';

	interface Props {
		theta1: number;
		theta2: number;
		omega1: number;
		omega2: number;
		l1: number;
		l2: number;
		m1: number;
		m2: number;
		gravity: number;
		damping: number;
		speed?: number;
		showTrail?: boolean;
		trailLength?: number;
		compareMode?: boolean;
		compareOffset?: number;
		/** Increment to force a restart (Reset/Randomize) even if initial conditions are unchanged. */
		restartSignal?: number;
		running?: boolean;
		height?: number;
		/** Live distance between the two second-bobs (output). 0 when comparison is off. */
		divergenceValue?: number;
		/** Set true when the simulation blows up to NaN/Infinity (output). */
		diverged?: boolean;
		/** Container element exposed for SnapshotButton. */
		containerElement?: HTMLDivElement;
	}

	let {
		theta1,
		theta2,
		omega1,
		omega2,
		l1,
		l2,
		m1,
		m2,
		gravity,
		damping,
		speed = 1,
		showTrail = true,
		trailLength = 400,
		compareMode = false,
		compareOffset = 0.001,
		restartSignal = 0,
		running = $bindable(true),
		height = 600,
		divergenceValue = $bindable(0),
		diverged = $bindable(false),
		containerElement = $bindable()
	}: Props = $props();

	const FIXED_DT = 0.005; // physics timestep (s)
	const MAX_FRAME_DT = 0.05; // clamp elapsed time after tab inactivity (s)
	const MAX_STEPS_PER_FRAME = 240; // avoid the "spiral of death"

	let container = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();

	let stateA: PendulumState = { theta1, theta2, omega1, omega2 };
	let stateB: PendulumState = { theta1: theta1 + compareOffset, theta2, omega1, omega2 };
	let trailA: Array<{ x: number; y: number }> = [];
	let trailB: Array<{ x: number; y: number }> = [];

	let physics: PendulumPhysics = { l1, l2, m1, m2, gravity, damping };

	$effect(() => {
		containerElement = container;
	});

	// Live physical parameters — apply without re-seeding.
	$effect(() => {
		physics = { l1, l2, m1, m2, gravity, damping };
	});

	// Re-seed when initial conditions, compare settings, or restartSignal change.
	$effect(() => {
		void theta1;
		void theta2;
		void omega1;
		void omega2;
		void compareMode;
		void compareOffset;
		void restartSignal;
		stateA = { theta1, theta2, omega1, omega2 };
		stateB = { theta1: theta1 + compareOffset, theta2, omega1, omega2 };
		trailA = [];
		trailB = [];
		divergenceValue = 0;
		diverged = false;
	});

	function pushTrail(trail: Array<{ x: number; y: number }>, x: number, y: number) {
		trail.push({ x, y });
		if (trail.length > trailLength) trail.splice(0, trail.length - trailLength);
	}

	function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
		ctx.clearRect(0, 0, w, h);

		const totalLen = physics.l1 + physics.l2 || 1;
		const scale = (Math.min(w, h) * 0.42) / totalLen;
		const pivotX = w / 2;
		const pivotY = h * 0.32;

		const toPx = (x: number, y: number) => ({ px: pivotX + x * scale, py: pivotY + y * scale });

		const drawTrail = (trail: Array<{ x: number; y: number }>, rgb: string) => {
			if (!showTrail || trail.length < 2) return;
			for (let i = 1; i < trail.length; i++) {
				const a = toPx(trail[i - 1].x, trail[i - 1].y);
				const b = toPx(trail[i].x, trail[i].y);
				ctx.strokeStyle = `rgba(${rgb}, ${(i / trail.length) * 0.7})`;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.moveTo(a.px, a.py);
				ctx.lineTo(b.px, b.py);
				ctx.stroke();
			}
		};

		const drawArms = (s: PendulumState, color: string, dim: boolean) => {
			const pos = bobPositions(s, physics);
			const p1 = toPx(pos.x1, pos.y1);
			const p2 = toPx(pos.x2, pos.y2);
			ctx.strokeStyle = color;
			ctx.globalAlpha = dim ? 0.7 : 1;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(pivotX, pivotY);
			ctx.lineTo(p1.px, p1.py);
			ctx.lineTo(p2.px, p2.py);
			ctx.stroke();
			ctx.fillStyle = color;
			const r1 = 4 + 2 * Math.sqrt(physics.m1);
			const r2 = 4 + 2 * Math.sqrt(physics.m2);
			ctx.beginPath();
			ctx.arc(p1.px, p1.py, r1, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(p2.px, p2.py, r2, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		};

		// pivot
		ctx.fillStyle = '#00f3ff';
		ctx.beginPath();
		ctx.arc(pivotX, pivotY, 3, 0, Math.PI * 2);
		ctx.fill();

		drawTrail(trailA, '0, 243, 255');
		if (compareMode) drawTrail(trailB, '255, 0, 255');
		if (compareMode) drawArms(stateB, '#ff00ff', true);
		drawArms(stateA, '#00f3ff', false);
	}

	onMount(() => {
		if (!canvas || !container) return;
		const cv = canvas;
		const ctx = cv.getContext('2d');
		if (!ctx) return;

		let raf = 0;
		let last = 0;
		let acc = 0;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			const w = container!.clientWidth;
			const h = container!.clientHeight;
			cv.width = Math.max(1, Math.floor(w * dpr));
			cv.height = Math.max(1, Math.floor(h * dpr));
			cv.style.width = w + 'px';
			cv.style.height = h + 'px';
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(container);

		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			if (last === 0) last = now;
			let frameDt = (now - last) / 1000;
			last = now;
			if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;

			if (running && !diverged) {
				acc += Math.min(frameDt, MAX_FRAME_DT) * speed;
				let steps = 0;
				while (acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
					stateA = rk4Step(stateA, physics, FIXED_DT);
					if (compareMode) stateB = rk4Step(stateB, physics, FIXED_DT);
					acc -= FIXED_DT;
					steps += 1;
					if (!isFiniteState(stateA) || (compareMode && !isFiniteState(stateB))) {
						diverged = true;
						running = false;
						acc = 0;
						break;
					}
				}
				if (acc > FIXED_DT * MAX_STEPS_PER_FRAME) acc = 0;

				const pa = bobPositions(stateA, physics);
				pushTrail(trailA, pa.x2, pa.y2);
				if (compareMode) {
					const pb = bobPositions(stateB, physics);
					pushTrail(trailB, pb.x2, pb.y2);
					divergenceValue = divergence(stateA, stateB, physics);
				}
			}

			const dpr = window.devicePixelRatio || 1;
			draw(ctx, cv.width / dpr, cv.height / dpr);
		};
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative backdrop-blur-md"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} class="block"></canvas>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Orbitron'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		DOUBLE_PENDULUM_RENDERER
	</div>
	{#if compareMode}
		<div
			data-testid="divergence-readout"
			class="absolute top-4 left-4 text-xs font-mono text-fuchsia-300 border border-fuchsia-500/30 bg-black/50 px-2 py-1 pointer-events-none select-none"
		>
			DIVERGENCE: {divergenceValue.toFixed(3)}
		</div>
	{/if}
	{#if diverged}
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div class="bg-black/80 border border-fuchsia-500/60 rounded-sm px-6 py-3 text-center">
				<p class="text-fuchsia-400 font-['Orbitron'] text-sm tracking-widest uppercase">
					⚠ SIMULATION DIVERGED
				</p>
				<p class="text-fuchsia-300/70 text-xs mt-1">Reset or reduce parameter extremes</p>
			</div>
		</div>
	{/if}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/lib/components/visualizations/DoublePendulumRenderer.svelte.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `bun run check`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/visualizations/DoublePendulumRenderer.svelte src/lib/components/visualizations/DoublePendulumRenderer.svelte.test.ts
git commit -m "feat: add double pendulum canvas renderer (HPA-56)"
```

---

## Task 7: Main module page

**Files:**

- Create: `src/routes/double-pendulum/+page.svelte`

This page closely follows `src/routes/ikeda/+page.svelte`. **Start by copying that file**, then apply the changes below. The boilerplate that carries over **unchanged in shape** (only the `mapType` string and parameter object differ): the URL-config-loading `$effect`, the `createSaveHandler`/`createShareHandler` wiring, the `SaveConfigDialog`/`ShareDialog`/`SnapshotButton`/`VisualizationAlerts` usage, and the preset bar.

- [ ] **Step 1: Copy the template**

```bash
cp src/routes/ikeda/+page.svelte src/routes/double-pendulum/+page.svelte
```

(Create the directory first if needed: `mkdir -p src/routes/double-pendulum`.)

- [ ] **Step 2: Replace the script imports and state block**

Replace the top of the `<script>` (imports + state declarations through `applyPreset`) so it reads:

```svelte
<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import DoublePendulumRenderer from '$lib/components/visualizations/DoublePendulumRenderer.svelte';
	import { VIZ_CONTAINER_HEIGHT } from '$lib/constants';
	import { checkParameterStability } from '$lib/chaos-validation';
	import {
		loadSavedConfigParameters,
		loadSharedConfigParameters,
		parseConfigParam
	} from '$lib/saved-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import type { DoublePendulumParameters } from '$lib/types';
	import { randomizeInitialConditions } from '$lib/double-pendulum';
	import {
		DOUBLE_PENDULUM_PRESETS,
		getPreset,
		detectPresetId,
		DEFAULT_DOUBLE_PENDULUM_PRESET_ID,
		type DoublePendulumState
	} from '$lib/double-pendulum-presets';

	// Keep the `data` prop the layout passes to every page (matches the Ikeda template;
	// render(...) in tests supplies it via `pageProps`).
	let { data } = $props();
	void data;

	let rendererContainer = $state<HTMLDivElement>();

	const defaultPreset = getPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	if (!defaultPreset)
		throw new Error(`Missing default preset: ${DEFAULT_DOUBLE_PENDULUM_PRESET_ID}`);
	const d = defaultPreset.state;

	let theta1 = $state(d.theta1);
	let theta2 = $state(d.theta2);
	let omega1 = $state(d.omega1);
	let omega2 = $state(d.omega2);
	let l1 = $state(d.l1);
	let l2 = $state(d.l2);
	let m1 = $state(d.m1);
	let m2 = $state(d.m2);
	let gravity = $state(d.gravity);
	let damping = $state(d.damping);
	let speed = $state(d.speed);
	let showTrail = $state(d.showTrail);
	let trailLength = $state(d.trailLength);
	let compareMode = $state(d.compareMode);
	let compareOffset = $state(d.compareOffset);

	let running = $state(true);
	let restartSignal = $state(0);
	let divergenceValue = $state(0);
	let diverged = $state(false);
	let showAdvanced = $state(false);

	let lastAppliedConfigKey: string | null = null;
	let configLoadAbortController: AbortController | null = null;
	let isUnmounted = false;

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());

	let configErrors = $state<string[]>([]);
	let showConfigError = $state(false);
	let stabilityWarnings = $state<string[]>([]);
	let showStabilityWarning = $state(false);

	function currentPresetState(): DoublePendulumState {
		return {
			theta1,
			theta2,
			omega1,
			omega2,
			l1,
			l2,
			m1,
			m2,
			gravity,
			damping,
			speed,
			showTrail,
			trailLength,
			compareMode,
			compareOffset
		};
	}

	const activePresetId = $derived(detectPresetId(currentPresetState()));
	const activePresetLabel = $derived(
		activePresetId ? (getPreset(activePresetId)?.label ?? 'CUSTOM') : 'CUSTOM'
	);

	function applyPreset(id: string) {
		const preset = getPreset(id);
		if (!preset) return;
		const s = preset.state;
		theta1 = s.theta1;
		theta2 = s.theta2;
		omega1 = s.omega1;
		omega2 = s.omega2;
		l1 = s.l1;
		l2 = s.l2;
		m1 = s.m1;
		m2 = s.m2;
		gravity = s.gravity;
		damping = s.damping;
		speed = s.speed;
		showTrail = s.showTrail;
		trailLength = s.trailLength;
		compareMode = s.compareMode;
		compareOffset = s.compareOffset;
		restartSignal += 1;
		runStabilityCheck();
	}

	function runStabilityCheck() {
		const stability = checkParameterStability('double-pendulum', getParameters());
		if (!stability.isStable) {
			stabilityWarnings = stability.warnings;
			showStabilityWarning = true;
		} else {
			stabilityWarnings = [];
			showStabilityWarning = false;
		}
	}

	function resetToDefaults() {
		applyPreset(DEFAULT_DOUBLE_PENDULUM_PRESET_ID);
	}

	function randomize() {
		const ic = randomizeInitialConditions();
		theta1 = ic.theta1;
		theta2 = ic.theta2;
		omega1 = ic.omega1;
		omega2 = ic.omega2;
		diverged = false;
		running = true;
		restartSignal += 1;
	}
</script>
```

- [ ] **Step 3: Update the URL-loading effect, `applyParameters`, and `getParameters`**

In the copied URL-config `$effect`, replace every `mapType: 'ikeda'` and `loadSavedConfigParameters<'ikeda'>` with `'double-pendulum'`, and replace the `applyParameters`/`getParameters` functions with:

```svelte
	function applyParameters(p: DoublePendulumParameters) {
		theta1 = p.theta1;
		theta2 = p.theta2;
		omega1 = p.omega1;
		omega2 = p.omega2;
		l1 = p.l1;
		l2 = p.l2;
		m1 = p.m1;
		m2 = p.m2;
		gravity = p.gravity;
		damping = p.damping;
		speed = p.speed ?? speed;
		showTrail = p.showTrail ?? showTrail;
		trailLength = p.trailLength ?? trailLength;
		compareMode = p.compareMode ?? compareMode;
		compareOffset = p.compareOffset ?? compareOffset;
		diverged = false;
		running = true;
		restartSignal += 1;
		runStabilityCheck();
	}

	function getParameters(): DoublePendulumParameters {
		return {
			type: 'double-pendulum',
			theta1,
			theta2,
			omega1,
			omega2,
			l1,
			l2,
			m1,
			m2,
			gravity,
			damping,
			speed,
			showTrail,
			trailLength,
			compareMode,
			compareOffset
		};
	}
```

Then update the two handler-creation calls to use the new map type:

```svelte
	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'double-pendulum',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'double-pendulum',
		shareState,
		getParameters
	);
```

Keep the existing `onMount`/unmount cleanup block from the Ikeda template (it sets `isUnmounted = true` and calls the cleanups) unchanged.

- [ ] **Step 4: Replace the markup body**

Replace the template markup (everything after the `</script>`) with the structure below. Keep the Ikeda page's outer header layout (title, Share/Save/Return buttons, `VisualizationAlerts`, preset bar) — only the title text, the renderer block, the control panel, and the educational copy differ. Title uses `DOUBLE_PENDULUM`. Use this for the renderer + controls region:

```svelte
<!-- Renderer -->
<div bind:this={rendererContainer}>
	<DoublePendulumRenderer
		{theta1}
		{theta2}
		{omega1}
		{omega2}
		{l1}
		{l2}
		{m1}
		{m2}
		{gravity}
		{damping}
		{speed}
		{showTrail}
		{trailLength}
		{compareMode}
		{compareOffset}
		{restartSignal}
		bind:running
		bind:divergenceValue
		bind:diverged
		height={VIZ_CONTAINER_HEIGHT}
	/>
</div>

<!-- Playback actions -->
<div class="flex flex-wrap gap-3">
	<button
		data-testid="toggle-play"
		onclick={() => (running = !running)}
		class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold"
	>
		{running ? '⏸ Pause' : '▶ Play'}
	</button>
	<button
		data-testid="reset"
		onclick={resetToDefaults}
		class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold"
	>
		↺ Reset
	</button>
	<button
		data-testid="randomize"
		onclick={randomize}
		class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm uppercase tracking-widest text-sm font-bold"
	>
		🎲 Randomize
	</button>
	<button
		data-testid="toggle-trail"
		onclick={() => (showTrail = !showTrail)}
		aria-pressed={showTrail}
		class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm uppercase tracking-widest text-sm font-bold"
	>
		{showTrail ? '✦ Trail On' : '✧ Trail Off'}
	</button>
	<button
		data-testid="toggle-compare"
		onclick={() => (compareMode = !compareMode)}
		aria-pressed={compareMode}
		class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm uppercase tracking-widest text-sm font-bold"
	>
		{compareMode ? '⧉ Comparison On' : '⧉ Comparison Off'}
	</button>
	<SnapshotButton target={rendererContainer} targetType="container" mapType="double-pendulum" />
</div>
```

For the **Basic** controls (always visible) build a sliders panel matching the Ikeda "SYSTEM_PARAMETERS" card styling, with sliders for: `theta1` (min `-3.14159`, max `3.14159`, step `0.01`), `theta2` (same range), `gravity` (min `0`, max `50`, step `0.1`), `speed` (min `0`, max `10`, step `0.1`). Each slider follows the exact Ikeda pattern — a `<label>`, a `<span data-testid="value-<name>">` showing the value, and an `<input type="range" data-testid="slider-<name>" bind:value={...}>`. Example for one slider (replicate for each):

```svelte
<div class="space-y-2">
	<div class="flex justify-between items-end">
		<label for="theta1" class="text-primary/80 text-xs uppercase tracking-widest font-bold"
			>Angle 1 (θ₁)</label
		>
		<span data-testid="value-theta1" class="font-mono text-accent">{theta1.toFixed(2)}</span>
	</div>
	<input
		id="theta1"
		data-testid="slider-theta1"
		type="range"
		bind:value={theta1}
		min="-3.14159"
		max="3.14159"
		step="0.01"
		class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
	/>
</div>
```

Add a collapsible **Advanced** section toggled by `showAdvanced` (`<button onclick={() => (showAdvanced = !showAdvanced)}>`), wrapping sliders for: `omega1` (min `-10`, max `10`, step `0.1`), `omega2` (same), `l1` (min `0.1`, max `5`, step `0.05`), `l2` (same), `m1` (min `0.1`, max `10`, step `0.1`), `m2` (same), `damping` (min `0`, max `2`, step `0.01`), `trailLength` (min `1`, max `5000`, step `1`), `compareOffset` (min `0`, max `0.1`, step `0.001`). Same per-slider pattern and `data-testid` convention.

Finally, add an educational copy panel (reuse the card styling) explaining the chaos in plain language:

```svelte
<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-3">
	<h2 class="text-xl font-['Orbitron'] font-semibold text-primary">WHY_IS_IT_CHAOTIC?</h2>
	<p class="text-muted-foreground font-['Rajdhani'] leading-relaxed">
		A double pendulum is two pendulums joined end to end. Its motion is governed by simple, fully
		deterministic equations — yet it is famously unpredictable. The system is acutely
		<span class="text-primary">sensitive to initial conditions</span>: change a starting angle by a
		fraction of a degree and the two paths stay close for a moment, then diverge completely. Turn on
		<span class="text-accent">comparison mode</span> to watch a second, almost-identical pendulum peel
		away from the first.
	</p>
</div>
```

Add a compare-route link button near the header actions (matching how other pages link to their compare route), pointing to `base + '/double-pendulum/compare'`.

- [ ] **Step 5: Type-check and lint**

Run: `bun run check && bun run lint`
Expected: no errors. Fix any unused imports left over from the Ikeda copy.

- [ ] **Step 6: Manual smoke test**

Run: `bun run dev`
Visit `http://localhost:5173/double-pendulum`. Verify: the pendulum animates; Pause/Play, Reset, Randomize, Trail toggle, and Comparison toggle all work; the divergence readout appears in comparison mode and grows over time; sliders change the motion.

- [ ] **Step 7: Commit**

```bash
git add src/routes/double-pendulum/+page.svelte
git commit -m "feat: add double pendulum module page (HPA-56)"
```

---

## Task 8: Homepage card

**Files:**

- Modify: `src/routes/+page.svelte`
- Test: `src/routes/page.svelte.test.ts`

- [ ] **Step 1: Update the homepage-card tests first**

In `src/routes/page.svelte.test.ts`:

- Change `it('renders all 13 visualization cards', ...)` and its `expect(links).toHaveLength(13)` to `14`.
- Change the `'renders "Initialize Module" call-to-action on each card'` assertion `expect(ctaElements).toHaveLength(13)` to `14`.
- Add `{ name: 'Double Pendulum', url: '/double-pendulum' }` to the local `visualizations` array used by the per-card `it.each`-style loop.

Run: `bun run vitest run src/routes/page.svelte.test.ts`
Expected: FAIL (card not present yet).

- [ ] **Step 2: Add the card**

In `src/routes/+page.svelte`, append to the `visualizations` array (after the `Chua Circuit` entry, adding a comma after it):

```ts
		{
			name: 'Chua Circuit',
			description:
				'A nonlinear circuit model whose state spirals between two lobes, producing the classic double-scroll attractor',
			url: '/chua',
			color: 'from-red-500 to-amber-600'
		},
		{
			name: 'Double Pendulum',
			description:
				'A physical chaotic system where tiny angle changes produce wildly different motion',
			url: '/double-pendulum',
			color: 'from-lime-400 to-emerald-600'
		}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `bun run vitest run src/routes/page.svelte.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte src/routes/page.svelte.test.ts
git commit -m "feat: add double pendulum homepage card (HPA-56)"
```

---

## Task 9: Compare route

**Files:**

- Create: `src/routes/double-pendulum/compare/+page.svelte`

This route follows `src/routes/ikeda/compare/+page.svelte`: two independent `DoublePendulumRenderer` instances laid out via `ComparisonLayout`, with `ComparisonParameterPanel`s, decoding/encoding state through `comparison-url-state`, and clamping params with `getStableRanges`.

- [ ] **Step 1: Copy the template**

```bash
mkdir -p src/routes/double-pendulum/compare
cp src/routes/ikeda/compare/+page.svelte src/routes/double-pendulum/compare/+page.svelte
```

- [ ] **Step 2: Adapt imports and types**

Replace `IkedaRenderer` import with `DoublePendulumRenderer`, replace `import type { IkedaParameters, IkedaRenderMode }` with `import type { DoublePendulumParameters }`, and change all three `'ikeda'` literals in `decodeComparisonState(...)`, `getDefaultParameters(...)`, and `getStableRanges(...)` to `'double-pendulum'`.

- [ ] **Step 3: Adapt `clampParams` and state**

Replace the `clampParams` body so it clamps the ten double-pendulum numeric fields against `ranges` (the same `clampValue` helper from the template), returning a `DoublePendulumParameters`. Replace the per-side `$state` declarations and the `ComparisonParameterPanel` slider config to expose the meaningful comparison parameters: `theta1`, `theta2`, `gravity`, plus `l1`/`l2`/`m1`/`m2` if the panel supports them. Pass each side's params into a `DoublePendulumRenderer` with `height` from `VIZ_CONTAINER_HEIGHT`. Mirror the Ikeda compare file's debounced URL-encoding `$effect`, swapping the field list for the double-pendulum fields.

Keep the "styling shared from the left side" comment pattern only if you choose to share `speed`/`trailLength`; otherwise give each side independent values. Each renderer should set `running={true}` and a fixed `showTrail={true}`.

- [ ] **Step 4: Type-check and lint**

Run: `bun run check && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `bun run dev`; visit `http://localhost:5173/double-pendulum/compare`. Verify two pendulums animate side by side and that changing one side's parameters updates only that side and the URL.

- [ ] **Step 6: Add the compare render test**

In `src/routes/visualization-pages.svelte.test.ts` (which uses a `setPageUrl(url)` helper, a shared `pageProps` object, and `screen` text assertions — main pages render with `{ props: pageProps }`, compare pages render with no props and assert `LEFT_PARAMETERS`/`RIGHT_PARAMETERS`):

- Add imports alongside the others: `import DoublePendulumPage from './double-pendulum/+page.svelte';` and `import DoublePendulumComparePage from './double-pendulum/compare/+page.svelte';`
- Add render tests mirroring the chua ones (the main-page heading renders the `DOUBLE_PENDULUM` display name from Task 7):

```ts
it('renders double pendulum page', () => {
	setPageUrl('http://localhost/double-pendulum');
	render(DoublePendulumPage, { props: pageProps });
	expect(screen.getByText('DOUBLE_PENDULUM')).toBeInTheDocument();
});

it('renders double pendulum compare page', () => {
	setPageUrl('http://localhost/double-pendulum/compare?compare=true');
	render(DoublePendulumComparePage);
	expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
	expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
});
```

(If the heading text differs from `DOUBLE_PENDULUM` because of how you titled the page in Task 7, assert on the actual heading text instead. If the file's `dialogTestCases` array drives save/share dialog tests per page and you wired those dialogs into the page, add a `double-pendulum` entry; otherwise leave that array unchanged.)

Run: `bun run vitest run src/routes/visualization-pages.svelte.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/double-pendulum/compare/+page.svelte src/routes/visualization-pages.svelte.test.ts
git commit -m "feat: add double pendulum compare route (HPA-56)"
```

---

## Task 10: E2E test

**Files:**

- Create: `e2e/double-pendulum.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `e2e/double-pendulum.spec.ts`. Inspect an existing spec in `e2e/` first to match the base-path and navigation helpers, then:

```ts
import { expect, test } from '@playwright/test';

test('homepage card links to the double pendulum module', async ({ page }) => {
	await page.goto('/');
	const link = page.getByRole('link', { name: /Double Pendulum/i });
	await expect(link).toBeVisible();
	await link.click();
	await expect(page).toHaveURL(/\/double-pendulum/);
	await expect(page.locator('canvas')).toBeVisible();
});

test('controls drive the simulation', async ({ page }) => {
	await page.goto('/double-pendulum');
	await expect(page.locator('canvas')).toBeVisible();

	// Pause then play.
	await page.getByTestId('toggle-play').click();
	await page.getByTestId('toggle-play').click();

	// Reset and randomize do not throw and keep the canvas alive.
	await page.getByTestId('reset').click();
	await page.getByTestId('randomize').click();
	await expect(page.locator('canvas')).toBeVisible();

	// Trail toggle.
	await page.getByTestId('toggle-trail').click();

	// Comparison mode reveals the divergence readout.
	await page.getByTestId('toggle-compare').click();
	await expect(page.getByTestId('divergence-readout')).toBeVisible();
});

test('remains usable at a mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/double-pendulum');
	await expect(page.locator('canvas')).toBeVisible();
	await expect(page.getByTestId('toggle-play')).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E spec**

Run: `bun run test:e2e e2e/double-pendulum.spec.ts`
Expected: PASS. (If the runner needs a built/preview server, follow the same invocation the repo's other e2e specs use.)

- [ ] **Step 3: Commit**

```bash
git add e2e/double-pendulum.spec.ts
git commit -m "test: add double pendulum e2e coverage (HPA-56)"
```

---

## Task 11: Full verification & cleanup

- [ ] **Step 1: Run the whole unit/component suite**

Run: `bun run test`
Expected: PASS. If any **enumerating** test fails because it lists all map types (candidates: `src/lib/api-validation.test.ts`, `src/lib/server/db/schema.test.ts`), add `'double-pendulum'` (and the matching `DoublePendulumParameters` sample, using the valid object from Task 4 Step 1) so the assertion includes the new type. Re-run until green.

- [ ] **Step 2: Type-check, lint, format**

Run: `bun run check && bun run lint`
Expected: no errors.
If lint reports formatting, run: `bun run format` and re-run `bun run lint`.

- [ ] **Step 3: Production build sanity check**

Run: `bun run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Final acceptance walkthrough (manual)**

Run `bun run dev` and confirm every acceptance criterion:

- Homepage shows the Double Pendulum card linking to `/double-pendulum`.
- `/double-pendulum` renders with no console errors; pendulum animates, pauses, resumes, resets, randomizes.
- Sliders update the motion; trail toggles; comparison shows two diverging pendulums with a live readout.
- Save and Share dialogs open and a saved/shared config reloads correctly via URL.
- Snapshot downloads an image.
- `/double-pendulum/compare` shows two independent pendulums.
- Layout holds at a narrow mobile width.

- [ ] **Step 5: Commit any cleanup**

```bash
git add -A
git commit -m "chore: finalize double pendulum module integration (HPA-56)"
```

---

## Self-Review Notes (verification of plan coverage)

- **Homepage card / route / animation / controls / trail / comparison / educational copy / responsive** → Tasks 7, 8, 9, 10.
- **RK4 integrator, dt clamp, capped trail, NaN guards** → Tasks 1 and 6 (`MAX_FRAME_DT`, `MAX_STEPS_PER_FRAME`, `isFiniteState` → `diverged`).
- **Full save/share/snapshot/URL integration** → Tasks 3, 4, 5, 7 (`getParameters`/`applyParameters`, `createSaveHandler`/`createShareHandler`, `SnapshotButton`, config-loading effect).
- **Comparison overlay + separate compare route** → Task 6 (overlay + `divergence-readout`) and Task 9 (`/compare`).
- **Type/name consistency:** the renderer prop names (`theta1…compareOffset`, `restartSignal`, `running`, `divergenceValue`, `diverged`, `containerElement`) match the page's bindings in Task 7; `DoublePendulumParameters` fields match `getParameters`/`applyParameters`; `DoublePendulumState` (presets) includes every persisted field used by `detectPresetId`, `currentPresetState`, and `getDefaultParameters`.
- **Worker files intentionally untouched** — the double pendulum simulates in the renderer's rAF loop.

```

```
