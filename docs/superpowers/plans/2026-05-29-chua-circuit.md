# Chua Circuit Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/chua` chaos module visualizing the Chua circuit double-scroll attractor, with a single toggleable 3D/XY/XZ/YZ/Poincaré canvas, presets, color-by modes, transient removal, a live Lyapunov readout, and full save/share/compare/snapshot integration.

**Architecture:** A pure, DOM-free solver (`src/lib/chua.ts`, RK4 + piecewise diode + Lyapunov + Poincaré) feeds a single Three.js renderer (`ChuaRenderer.svelte`) that switches between a perspective camera (3D, auto-rotate) and an orthographic camera (locked 2D projections + Poincaré). The route page wires the standard shared infra used by every other module. New map type is registered in the existing type/validation/default/landing registries.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript (strict), Three.js, Bun test runner, Vitest, TailwindCSS v4.

**Spec:** `docs/superpowers/specs/2026-05-29-chua-circuit-visualization-design.md` (gitignored, on disk).

**Branch:** `feat/chua-circuit` (already created).

**Reference files to mirror (read before starting):**

- `src/lib/rossler.ts` + `src/lib/rossler.test.ts` — RK4 solver + test style.
- `src/lib/components/visualizations/LorenzRenderer.svelte` + `RosslerRenderer.svelte` — Three.js renderer + compare/camera-sync + disposal patterns.
- `src/routes/lorenz/+page.svelte` + `src/routes/lorenz/compare/+page.svelte` — page + compare patterns.

**Conventions:** This repo uses tabs for indentation and single quotes. Pre-commit hooks run lint-staged (ESLint + Prettier) — let them format. Run `bun run check` and `bun run lint` before declaring done.

---

## Task 1: Chua diode (`chuaDiode`)

**Files:**

- Create: `src/lib/chua.ts`
- Test: `src/lib/chua.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/chua.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { chuaDiode } from './chua';

describe('chuaDiode', () => {
	const a = -8 / 7;
	const b = -5 / 7;

	test('f(0) is 0', () => {
		expect(chuaDiode(0, a, b)).toBeCloseTo(0, 12);
	});

	test('inner region slope equals a', () => {
		// For |x| <= 1, f(x) = a*x
		expect(chuaDiode(0.5, a, b)).toBeCloseTo(a * 0.5, 12);
		expect(chuaDiode(-0.5, a, b)).toBeCloseTo(a * -0.5, 12);
	});

	test('is continuous at the breakpoint x = 1', () => {
		// Inner value at x=1 is a*1; outer formula must match
		expect(chuaDiode(1, a, b)).toBeCloseTo(a, 12);
	});

	test('outer region slope equals b', () => {
		// For x >= 1, f(x) = b*x + (a - b); slope is b
		const f2 = chuaDiode(2, a, b);
		const f3 = chuaDiode(3, a, b);
		expect(f3 - f2).toBeCloseTo(b, 12);
	});

	test('is odd-symmetric', () => {
		expect(chuaDiode(-2, a, b)).toBeCloseTo(-chuaDiode(2, a, b), 12);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/chua.test.ts`
Expected: FAIL — `chuaDiode` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/chua.ts`:

```ts
/**
 * Chua Circuit Solver
 *
 * Dimensionless Chua system (piecewise-linear 3D ODE):
 *   f(x)  = b*x + 0.5*(a - b)*(|x + 1| - |x - 1|)   // Chua diode
 *   dx/dt = alpha*(y - x - f(x))
 *   dy/dt = x - y + z
 *   dz/dt = -(beta*y + gamma*z)
 *
 * Classic double-scroll parameters: alpha = 15.6, beta = 28, gamma = 0,
 * a = -8/7, b = -5/7.
 */

/**
 * Chua diode piecewise-linear response.
 * Inner slope (|x| <= 1) is `a`; outer slope (|x| > 1) is `b`.
 */
export function chuaDiode(x: number, a: number, b: number): number {
	return b * x + 0.5 * (a - b) * (Math.abs(x + 1) - Math.abs(x - 1));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/chua.test.ts`
Expected: PASS (5 tests in `chuaDiode`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chua.ts src/lib/chua.test.ts
git commit -m "feat(chua): add piecewise Chua diode function"
```

---

## Task 2: RK4 trajectory (`calculateChua`)

**Files:**

- Modify: `src/lib/chua.ts`
- Test: `src/lib/chua.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/chua.test.ts` (inside the file, after the `chuaDiode` describe block):

```ts
import { calculateChua } from './chua';

describe('calculateChua', () => {
	const base = {
		x0: 0.1,
		y0: 0,
		z0: 0,
		dt: 0.005,
		alpha: 15.6,
		beta: 28,
		gamma: 0,
		a: -8 / 7,
		b: -5 / 7
	};

	test('returns array of the requested length', () => {
		const points = calculateChua({ ...base, steps: 100 });
		expect(points).toHaveLength(100);
	});

	test('handles zero steps', () => {
		expect(calculateChua({ ...base, steps: 0 })).toHaveLength(0);
	});

	test('all points are finite', () => {
		const points = calculateChua({ ...base, steps: 500 });
		for (const p of points) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
			expect(Number.isFinite(p.z)).toBe(true);
		}
	});

	test('matches RK4 formula for the first step', () => {
		const { x0, y0, z0, dt, alpha, beta, gamma, a, b } = base;
		const deriv = (x: number, y: number, z: number) => {
			const fx = chuaDiode(x, a, b);
			return {
				dx: alpha * (y - x - fx),
				dy: x - y + z,
				dz: -(beta * y + gamma * z)
			};
		};
		const k1 = deriv(x0, y0, z0);
		const k2 = deriv(x0 + (dt * k1.dx) / 2, y0 + (dt * k1.dy) / 2, z0 + (dt * k1.dz) / 2);
		const k3 = deriv(x0 + (dt * k2.dx) / 2, y0 + (dt * k2.dy) / 2, z0 + (dt * k2.dz) / 2);
		const k4 = deriv(x0 + dt * k3.dx, y0 + dt * k3.dy, z0 + dt * k3.dz);
		const expectedX = x0 + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
		const expectedY = y0 + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);
		const expectedZ = z0 + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz);

		const points = calculateChua({ ...base, steps: 1 });
		expect(points[0].x).toBeCloseTo(expectedX, 10);
		expect(points[0].y).toBeCloseTo(expectedY, 10);
		expect(points[0].z).toBeCloseTo(expectedZ, 10);
	});

	test('classic parameters stay bounded (double-scroll attractor)', () => {
		const points = calculateChua({ ...base, steps: 20000 });
		for (const p of points) {
			expect(Math.abs(p.x)).toBeLessThan(50);
			expect(Math.abs(p.y)).toBeLessThan(50);
			expect(Math.abs(p.z)).toBeLessThan(50);
		}
	});

	test('is deterministic for identical input', () => {
		const a1 = calculateChua({ ...base, steps: 300 });
		const a2 = calculateChua({ ...base, steps: 300 });
		expect(a1[299]).toEqual(a2[299]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/chua.test.ts`
Expected: FAIL — `calculateChua` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/chua.ts`:

```ts
export interface ChuaPoint {
	x: number;
	y: number;
	z: number;
}

export interface ChuaParams {
	x0: number;
	y0: number;
	z0: number;
	steps: number;
	dt: number;
	alpha: number;
	beta: number;
	gamma: number;
	a: number;
	b: number;
}

interface Derivatives {
	dx: number;
	dy: number;
	dz: number;
}

function chuaDerivatives(
	x: number,
	y: number,
	z: number,
	alpha: number,
	beta: number,
	gamma: number,
	a: number,
	b: number
): Derivatives {
	const fx = chuaDiode(x, a, b);
	return {
		dx: alpha * (y - x - fx),
		dy: x - y + z,
		dz: -(beta * y + gamma * z)
	};
}

/**
 * Advance one RK4 step. Shared by `calculateChua` and `estimateLargestLyapunov`.
 */
function rk4Step(
	x: number,
	y: number,
	z: number,
	dt: number,
	alpha: number,
	beta: number,
	gamma: number,
	a: number,
	b: number
): ChuaPoint {
	const k1 = chuaDerivatives(x, y, z, alpha, beta, gamma, a, b);
	const k2 = chuaDerivatives(
		x + (dt * k1.dx) / 2,
		y + (dt * k1.dy) / 2,
		z + (dt * k1.dz) / 2,
		alpha,
		beta,
		gamma,
		a,
		b
	);
	const k3 = chuaDerivatives(
		x + (dt * k2.dx) / 2,
		y + (dt * k2.dy) / 2,
		z + (dt * k2.dz) / 2,
		alpha,
		beta,
		gamma,
		a,
		b
	);
	const k4 = chuaDerivatives(
		x + dt * k3.dx,
		y + dt * k3.dy,
		z + dt * k3.dz,
		alpha,
		beta,
		gamma,
		a,
		b
	);
	return {
		x: x + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
		y: y + (dt / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
		z: z + (dt / 6) * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz)
	};
}

/**
 * Calculate the Chua trajectory using 4th-order Runge–Kutta integration.
 */
export function calculateChua(params: ChuaParams): ChuaPoint[] {
	const { x0, y0, z0, steps, dt, alpha, beta, gamma, a, b } = params;
	const points: ChuaPoint[] = [];
	let x = x0;
	let y = y0;
	let z = z0;
	for (let i = 0; i < steps; i++) {
		const next = rk4Step(x, y, z, dt, alpha, beta, gamma, a, b);
		x = next.x;
		y = next.y;
		z = next.z;
		points.push({ x, y, z });
	}
	return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/chua.test.ts`
Expected: PASS (all `chuaDiode` + `calculateChua` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chua.ts src/lib/chua.test.ts
git commit -m "feat(chua): add RK4 trajectory solver"
```

---

## Task 3: Poincaré section (`computePoincareSection`)

**Files:**

- Modify: `src/lib/chua.ts`
- Test: `src/lib/chua.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/chua.test.ts`:

```ts
import { computePoincareSection } from './chua';

describe('computePoincareSection', () => {
	test('records an upward crossing of y = 0 with interpolated coords', () => {
		// y goes -1 -> +1 between the two samples: crossing at t = 0.5.
		// In-plane coords for y=0 are (x, z): u = x, v = z.
		const pts = [
			{ x: 0, y: -1, z: 10 },
			{ x: 2, y: 1, z: 20 }
		];
		const section = computePoincareSection(pts, 'y=0');
		expect(section).toHaveLength(1);
		expect(section[0].u).toBeCloseTo(1, 10); // x interpolated at t=0.5
		expect(section[0].v).toBeCloseTo(15, 10); // z interpolated at t=0.5
	});

	test('ignores downward crossings (consistent direction)', () => {
		const pts = [
			{ x: 0, y: 1, z: 0 },
			{ x: 2, y: -1, z: 0 }
		];
		expect(computePoincareSection(pts, 'y=0')).toHaveLength(0);
	});

	test('x=0 plane uses (y, z) as in-plane coords', () => {
		const pts = [
			{ x: -1, y: 4, z: 8 },
			{ x: 1, y: 6, z: 12 }
		];
		const section = computePoincareSection(pts, 'x=0');
		expect(section).toHaveLength(1);
		expect(section[0].u).toBeCloseTo(5, 10); // y at t=0.5
		expect(section[0].v).toBeCloseTo(10, 10); // z at t=0.5
	});

	test('z=0 plane uses (x, y) as in-plane coords', () => {
		const pts = [
			{ x: 2, y: 4, z: -2 },
			{ x: 6, y: 8, z: 2 }
		];
		const section = computePoincareSection(pts, 'z=0');
		expect(section).toHaveLength(1);
		expect(section[0].u).toBeCloseTo(4, 10); // x at t=0.5
		expect(section[0].v).toBeCloseTo(6, 10); // y at t=0.5
	});

	test('returns empty array for fewer than 2 points', () => {
		expect(computePoincareSection([], 'y=0')).toHaveLength(0);
		expect(computePoincareSection([{ x: 0, y: 0, z: 0 }], 'y=0')).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/chua.test.ts`
Expected: FAIL — `computePoincareSection` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/chua.ts`:

```ts
export type PoincarePlane = 'x=0' | 'y=0' | 'z=0';

export interface PoincarePoint {
	/** First in-plane coordinate. */
	u: number;
	/** Second in-plane coordinate. */
	v: number;
}

/**
 * Collect points where the trajectory crosses the chosen plane in the
 * positive direction (the normal coordinate goes from negative to >= 0).
 * In-plane coordinate mapping:
 *   x=0 -> (y, z)
 *   y=0 -> (x, z)
 *   z=0 -> (x, y)
 */
export function computePoincareSection(points: ChuaPoint[], plane: PoincarePlane): PoincarePoint[] {
	const section: PoincarePoint[] = [];
	if (points.length < 2) return section;

	const normal = (p: ChuaPoint): number => (plane === 'x=0' ? p.x : plane === 'y=0' ? p.y : p.z);
	const inPlane = (p: ChuaPoint): PoincarePoint =>
		plane === 'x=0'
			? { u: p.y, v: p.z }
			: plane === 'y=0'
				? { u: p.x, v: p.z }
				: { u: p.x, v: p.y };

	for (let i = 1; i < points.length; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const nPrev = normal(prev);
		const nCurr = normal(curr);
		// Upward crossing only.
		if (nPrev < 0 && nCurr >= 0) {
			const denom = nCurr - nPrev;
			const t = denom === 0 ? 0 : -nPrev / denom;
			const a = inPlane(prev);
			const b = inPlane(curr);
			section.push({
				u: a.u + (b.u - a.u) * t,
				v: a.v + (b.v - a.v) * t
			});
		}
	}
	return section;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/chua.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chua.ts src/lib/chua.test.ts
git commit -m "feat(chua): add Poincaré section extraction"
```

---

## Task 4: Lyapunov estimate (`estimateLargestLyapunov` + `classifyLyapunov`)

**Files:**

- Modify: `src/lib/chua.ts`
- Test: `src/lib/chua.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/chua.test.ts`:

```ts
import { estimateLargestLyapunov, classifyLyapunov } from './chua';

describe('classifyLyapunov', () => {
	test('positive values are chaotic', () => {
		expect(classifyLyapunov(0.5)).toBe('chaotic');
	});
	test('near-zero values are marginal', () => {
		expect(classifyLyapunov(0)).toBe('marginal');
		expect(classifyLyapunov(0.005)).toBe('marginal');
	});
	test('clearly negative values are stable', () => {
		expect(classifyLyapunov(-0.5)).toBe('stable');
	});
});

describe('estimateLargestLyapunov', () => {
	const base = {
		x0: 0.1,
		y0: 0,
		z0: 0,
		steps: 8000,
		dt: 0.005,
		alpha: 15.6,
		beta: 28,
		gamma: 0,
		a: -8 / 7,
		b: -5 / 7
	};

	test('classic double scroll is chaotic (positive exponent)', () => {
		const est = estimateLargestLyapunov(base);
		expect(Number.isFinite(est.value)).toBe(true);
		expect(est.value).toBeGreaterThan(0);
		expect(est.classification).toBe('chaotic');
	});

	test('is deterministic', () => {
		expect(estimateLargestLyapunov(base).value).toBe(estimateLargestLyapunov(base).value);
	});

	test('strong damping lowers the exponent', () => {
		const damped = estimateLargestLyapunov({ ...base, gamma: 5 });
		const classic = estimateLargestLyapunov(base);
		expect(damped.value).toBeLessThan(classic.value);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/chua.test.ts`
Expected: FAIL — `estimateLargestLyapunov` / `classifyLyapunov` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/chua.ts`:

```ts
export type LyapunovClassification = 'chaotic' | 'marginal' | 'stable';

export interface LyapunovEstimate {
	value: number;
	classification: LyapunovClassification;
}

const LYAPUNOV_MARGINAL_THRESHOLD = 0.01;

export function classifyLyapunov(value: number): LyapunovClassification {
	if (value > LYAPUNOV_MARGINAL_THRESHOLD) return 'chaotic';
	if (value < -LYAPUNOV_MARGINAL_THRESHOLD) return 'stable';
	return 'marginal';
}

/**
 * Estimate the largest Lyapunov exponent using the Benettin two-trajectory
 * method: integrate a nearby trajectory, periodically measure separation
 * growth, renormalize, and average log growth over time.
 */
export function estimateLargestLyapunov(params: ChuaParams): LyapunovEstimate {
	const { x0, y0, z0, steps, dt, alpha, beta, gamma, a, b } = params;
	const d0 = 1e-8;

	let bx = x0;
	let by = y0;
	let bz = z0;
	// Perturb along x.
	let px = x0 + d0;
	let py = y0;
	let pz = z0;

	const transient = Math.min(2000, Math.floor(steps * 0.1));
	let sumLog = 0;
	let count = 0;

	for (let i = 0; i < steps; i++) {
		const nb = rk4Step(bx, by, bz, dt, alpha, beta, gamma, a, b);
		const np = rk4Step(px, py, pz, dt, alpha, beta, gamma, a, b);
		bx = nb.x;
		by = nb.y;
		bz = nb.z;
		px = np.x;
		py = np.y;
		pz = np.z;

		if (i >= transient) {
			const dx = px - bx;
			const dy = py - by;
			const dz = pz - bz;
			const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (dist > 0) {
				sumLog += Math.log(dist / d0);
				count++;
				// Renormalize the perturbed trajectory back to distance d0.
				const factor = d0 / dist;
				px = bx + dx * factor;
				py = by + dy * factor;
				pz = bz + dz * factor;
			}
		}
	}

	const value = count > 0 ? sumLog / (count * dt) : 0;
	return { value, classification: classifyLyapunov(value) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/chua.test.ts`
Expected: PASS (all solver tests). If `classic.value` is not > 0, increase `steps` in the test to 12000; the genuine double scroll has a positive exponent (~0.2–0.4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chua.ts src/lib/chua.test.ts
git commit -m "feat(chua): add largest Lyapunov exponent estimate"
```

---

## Task 5: Register the `chua` type

**Files:**

- Modify: `src/lib/types.ts`
- Modify: `src/lib/type-guards.ts`
- Modify: `src/lib/types.test.ts`

- [ ] **Step 1: Update `types.test.ts` (failing expectations first)**

In `src/lib/types.test.ts`:

Add `'chua'` to `EXPECTED_MAP_TYPES` (after `'lyapunov'`):

```ts
const EXPECTED_MAP_TYPES: ChaosMapType[] = [
	'lorenz',
	'rossler',
	'henon',
	'lozi',
	'logistic',
	'newton',
	'standard',
	'bifurcation-logistic',
	'bifurcation-henon',
	'chaos-esthetique',
	'lyapunov',
	'chua'
];
```

Change `VALID_MAP_TYPES` length expectation:

```ts
test('contains exactly 12 map types', () => {
	expect(VALID_MAP_TYPES).toHaveLength(12);
});
```

Change `CHAOS_MAP_DISPLAY_NAMES` count expectation:

```ts
test('has exactly 12 entries', () => {
	expect(Object.keys(CHAOS_MAP_DISPLAY_NAMES)).toHaveLength(12);
});
```

Add a mapping assertion inside the `maps each type to the correct display name` test:

```ts
expect(CHAOS_MAP_DISPLAY_NAMES['chua']).toBe('CHUA_CIRCUIT');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/types.test.ts`
Expected: FAIL — length is 11, no `chua` entry.

- [ ] **Step 3: Update `types.ts`**

In `src/lib/types.ts`:

Add `'chua'` to the `ChaosMapType` union (after `'lyapunov'`):

```ts
export type ChaosMapType =
	| 'lorenz'
	| 'rossler'
	| 'henon'
	| 'lozi'
	| 'logistic'
	| 'newton'
	| 'standard'
	| 'bifurcation-logistic'
	| 'bifurcation-henon'
	| 'chaos-esthetique'
	| 'lyapunov'
	| 'chua';
```

Add the parameter interface (after `LyapunovParameters`):

```ts
export interface ChuaParameters {
	type: 'chua';
	alpha: number;
	beta: number;
	gamma: number;
	a: number;
	b: number;
}
```

Add `ChuaParameters` to the `ChaosMapParameters` union (after `LyapunovParameters`):

```ts
	| LyapunovParameters
	| ChuaParameters;
```

Add the display name (after the `lyapunov` entry):

```ts
	lyapunov: 'LYAPUNOV_EXPONENTS',
	chua: 'CHUA_CIRCUIT'
```

Add to `VALID_MAP_TYPES` (after `'lyapunov'`):

```ts
('lyapunov', 'chua');
```

Add the `SavedConfiguration` branch (after the `lyapunov` branch, before the closing `)`):

```ts
		| {
				mapType: 'chua';
				parameters: ChuaParameters;
		  }
```

- [ ] **Step 4: Add the type guard to `type-guards.ts`**

In `src/lib/type-guards.ts`, add `ChuaParameters` to the type import list:

```ts
	LyapunovParameters,
	ChuaParameters
} from '$lib/types';
```

Add the guard at the end of the named guards (before `isParametersOfType`):

```ts
/**
 * Type guard for Chua parameters.
 */
export function isChuaParameters(
	params: ChaosMapParameters | null | undefined
): params is ChuaParameters {
	return params?.type === 'chua';
}
```

- [ ] **Step 5: Run tests + type check**

Run: `bun test src/lib/types.test.ts && bun run check`
Expected: types.test.ts PASS. `bun run check` will now report errors in any **exhaustive switch** over `ChaosMapType` that lacks a `chua` case — most importantly `getDefaultParameters` in `comparison-url-state.ts` (fixed in Task 6). If `check` flags other server files (e.g. `src/lib/server/share-utils.ts`), note them; add a `chua` branch mirroring the `rossler` branch in each. Do not commit until Task 6 makes `check` pass, OR commit now knowing the next task resolves the switch error.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/type-guards.ts src/lib/types.test.ts
git commit -m "feat(chua): register chua map type and guards"
```

---

## Task 6: Validation ranges + default parameters

**Files:**

- Modify: `src/lib/chaos-validation.ts`
- Modify: `src/lib/comparison-url-state.ts`
- Test: `src/lib/chua-validation.test.ts` (new, focused)

- [ ] **Step 1: Write the failing test**

Create `src/lib/chua-validation.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { checkParameterStability, getStableRanges, isValidMapType } from './chaos-validation';
import { getDefaultParameters } from './comparison-url-state';
import type { ChuaParameters } from './types';

describe('chua validation', () => {
	test('chua is a valid map type', () => {
		expect(isValidMapType('chua')).toBe(true);
	});

	test('has stable ranges for all five math params', () => {
		const ranges = getStableRanges('chua');
		expect(ranges).toBeDefined();
		expect(Object.keys(ranges ?? {}).sort()).toEqual(['a', 'alpha', 'b', 'beta', 'gamma']);
	});

	test('classic double-scroll parameters are stable', () => {
		const params: ChuaParameters = {
			type: 'chua',
			alpha: 15.6,
			beta: 28,
			gamma: 0,
			a: -8 / 7,
			b: -5 / 7
		};
		expect(checkParameterStability('chua', params).isStable).toBe(true);
	});

	test('out-of-range alpha produces a warning', () => {
		const params: ChuaParameters = {
			type: 'chua',
			alpha: 100,
			beta: 28,
			gamma: 0,
			a: -8 / 7,
			b: -5 / 7
		};
		const result = checkParameterStability('chua', params);
		expect(result.isStable).toBe(false);
		expect(result.warnings.join(' ')).toContain('alpha');
	});

	test('getDefaultParameters returns the classic preset', () => {
		const params = getDefaultParameters('chua') as ChuaParameters;
		expect(params.type).toBe('chua');
		expect(params.alpha).toBeCloseTo(15.6, 5);
		expect(params.beta).toBeCloseTo(28, 5);
		expect(params.gamma).toBe(0);
		expect(params.a).toBeCloseTo(-8 / 7, 5);
		expect(params.b).toBeCloseTo(-5 / 7, 5);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/chua-validation.test.ts`
Expected: FAIL — no `chua` ranges; `getDefaultParameters` has no `chua` case (TS error or runtime undefined).

- [ ] **Step 3: Add stable ranges in `chaos-validation.ts`**

In `src/lib/chaos-validation.ts`, add to the `STABLE_RANGES` object (after the `lyapunov` entry):

```ts
		lyapunov: {
			rMin: { min: 0, max: 4 },
			rMax: { min: 0, max: 4 },
			iterations: { min: 100, max: 10000 },
			transientIterations: { min: 50, max: 5000 }
		},
		chua: {
			alpha: { min: 8, max: 20 },
			beta: { min: 20, max: 53 },
			gamma: { min: -1, max: 1 },
			a: { min: -2, max: -0.5 },
			b: { min: -1.5, max: -0.3 }
		}
```

(Note: add a comma after the `lyapunov` closing brace.)

- [ ] **Step 4: Add the default in `comparison-url-state.ts`**

In `src/lib/comparison-url-state.ts`, add a case to `getDefaultParameters` (after the `lyapunov` case, before the closing `}`):

```ts
		case 'lyapunov':
			return {
				type: 'lyapunov',
				rMin: 2.5,
				rMax: 4.0,
				iterations: 100,
				transientIterations: 100
			};
		case 'chua':
			return { type: 'chua', alpha: 15.6, beta: 28, gamma: 0, a: -8 / 7, b: -5 / 7 };
```

- [ ] **Step 5: Run tests + type check**

Run: `bun test src/lib/chua-validation.test.ts && bun run check`
Expected: PASS, and `bun run check` clean of `chua`-related switch errors. Fix any remaining exhaustive-switch errors flagged by `check` by adding a `chua` branch mirroring `rossler`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chaos-validation.ts src/lib/comparison-url-state.ts src/lib/chua-validation.test.ts
git commit -m "feat(chua): add stability ranges and default parameters"
```

---

## Task 7: `ChuaRenderer` component

**Files:**

- Create: `src/lib/components/visualizations/ChuaRenderer.svelte`

No unit test (renderers are stubbed in vitest, like every other renderer). Verification is `bun run check` + a manual dev run in Task 11.

- [ ] **Step 1: Create the component**

Create `src/lib/components/visualizations/ChuaRenderer.svelte`:

```svelte
<!--
  ChuaRenderer Component

  Three.js renderer for the Chua circuit. A single canvas toggles between a
  perspective 3D view (auto-rotate) and orthographic 2D projections (XY/XZ/YZ)
  plus a Poincaré section. Supports comparison mode with camera sync.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import {
		calculateChua,
		computePoincareSection,
		type ChuaPoint,
		type PoincarePlane
	} from '$lib/chua';
	import { cameraSyncStore, createCameraState, applyCameraState } from '$lib/stores/camera-sync';
	import { AUTO_ROTATE_SPEED } from '$lib/constants';

	type ViewMode = '3d' | 'xy' | 'xz' | 'yz' | 'poincare';
	type ColorMode = 'time' | 'velocity' | 'z-height';

	interface Props {
		alpha?: number;
		beta?: number;
		gamma?: number;
		a?: number;
		b?: number;
		dt?: number;
		trailLength?: number;
		viewMode?: ViewMode;
		colorMode?: ColorMode;
		transientRemoval?: boolean;
		poincarePlane?: PoincarePlane;
		height?: number;
		compareMode?: boolean;
		compareSide?: 'left' | 'right';
		containerElement?: HTMLDivElement;
	}

	let {
		alpha = $bindable(15.6),
		beta = $bindable(28),
		gamma = $bindable(0),
		a = $bindable(-8 / 7),
		b = $bindable(-5 / 7),
		dt = 0.005,
		trailLength = 30000,
		viewMode = '3d',
		colorMode = 'time',
		transientRemoval = false,
		poincarePlane = 'y=0',
		height = 600,
		compareMode = false,
		compareSide = 'left',
		containerElement = $bindable()
	}: Props = $props();

	let container = $state<HTMLDivElement>();
	$effect(() => {
		containerElement = container;
	});

	let isAnimating = true;
	let animationFrameId: number | null = null;
	let rebuild: (() => void) | null = null;
	let applyView: (() => void) | null = null;
	let controls = $state<OrbitControls | null>(null);
	let perspectiveCamera = $state<THREE.PerspectiveCamera | null>(null);

	// Recompute geometry when math params / integration / color / transient change.
	$effect(() => {
		void alpha;
		void beta;
		void gamma;
		void a;
		void b;
		void dt;
		void trailLength;
		void colorMode;
		void transientRemoval;
		void poincarePlane;
		rebuild?.();
		applyView?.();
	});

	// Reapply camera/visibility when the view mode changes.
	$effect(() => {
		void viewMode;
		applyView?.();
	});

	// Camera sync (perspective / 3D only).
	$effect(() => {
		if (!compareMode) return;
		const c = controls;
		const cam = perspectiveCamera;
		if (!c || !cam) return;
		const unsubscribe = cameraSyncStore.subscribe((state) => {
			if (!state.enabled || state.lastUpdate === compareSide) return;
			const other = compareSide === 'left' ? state.right : state.left;
			if (other) applyCameraState(other, cam, c);
		});
		return unsubscribe;
	});

	onMount(() => {
		if (!container) return;
		const el = container;

		const scene = new THREE.Scene();
		scene.background = null;

		const persp = new THREE.PerspectiveCamera(75, el.clientWidth / el.clientHeight, 0.1, 2000);
		persp.position.set(18, 18, 18);
		perspectiveCamera = persp;

		const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 2000);

		let activeCamera: THREE.Camera = persp;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setSize(el.clientWidth, el.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		// eslint-disable-next-line svelte/no-dom-manipulating
		el.appendChild(renderer.domElement);

		const orbit = new OrbitControls(persp, renderer.domElement);
		orbit.enableDamping = true;
		orbit.autoRotate = !compareMode;
		orbit.autoRotateSpeed = AUTO_ROTATE_SPEED;
		controls = orbit;

		let cameraChangeHandler: (() => void) | null = null;
		if (compareMode) {
			cameraChangeHandler = () => {
				cameraSyncStore.updateFromSide(compareSide, createCameraState(persp, orbit));
			};
			orbit.addEventListener('change', cameraChangeHandler);
		}

		const CYAN = new THREE.Color(0x00f3ff);
		const MAGENTA = new THREE.Color(0xff00ff);

		function colorArrayFor(pts: ChuaPoint[], mode: ColorMode): Float32Array {
			const colors = new Float32Array(pts.length * 3);
			const tmp = new THREE.Color();
			const writes = (i: number, t: number) => {
				tmp.copy(CYAN).lerp(MAGENTA, Math.max(0, Math.min(1, t)));
				colors[i * 3] = tmp.r;
				colors[i * 3 + 1] = tmp.g;
				colors[i * 3 + 2] = tmp.b;
			};
			if (mode === 'time') {
				for (let i = 0; i < pts.length; i++) writes(i, pts.length > 1 ? i / (pts.length - 1) : 0);
			} else if (mode === 'z-height') {
				let min = Infinity;
				let max = -Infinity;
				for (const p of pts) {
					if (p.z < min) min = p.z;
					if (p.z > max) max = p.z;
				}
				const range = max - min || 1;
				for (let i = 0; i < pts.length; i++) writes(i, (pts[i].z - min) / range);
			} else {
				const speeds = new Float32Array(pts.length);
				let min = Infinity;
				let max = -Infinity;
				for (let i = 0; i < pts.length; i++) {
					const prev = i > 0 ? pts[i - 1] : pts[i];
					const dx = pts[i].x - prev.x;
					const dy = pts[i].y - prev.y;
					const dz = pts[i].z - prev.z;
					const s = Math.sqrt(dx * dx + dy * dy + dz * dz);
					speeds[i] = s;
					if (s < min) min = s;
					if (s > max) max = s;
				}
				const range = max - min || 1;
				for (let i = 0; i < pts.length; i++) writes(i, (speeds[i] - min) / range);
			}
			return colors;
		}

		const lineMaterial = new THREE.LineBasicMaterial({
			vertexColors: true,
			transparent: true,
			opacity: 0.85,
			blending: THREE.AdditiveBlending
		});
		const pointsMaterial = new THREE.PointsMaterial({
			color: 0x00f3ff,
			size: 3,
			sizeAttenuation: false
		});

		let trajectory: ChuaPoint[] = [];
		let line: THREE.Line | null = null;
		let points: THREE.Points | null = null;

		function disposeObjects() {
			if (line) {
				scene.remove(line);
				line.geometry.dispose();
				line = null;
			}
			if (points) {
				scene.remove(points);
				points.geometry.dispose();
				points = null;
			}
		}

		rebuild = () => {
			disposeObjects();

			const raw = calculateChua({
				x0: 0.1,
				y0: 0,
				z0: 0,
				steps: trailLength,
				dt,
				alpha,
				beta,
				gamma,
				a,
				b
			});
			const cut = transientRemoval ? Math.floor(raw.length * 0.05) : 0;
			trajectory = raw.slice(cut);

			const positions = new Float32Array(trajectory.length * 3);
			for (let i = 0; i < trajectory.length; i++) {
				positions[i * 3] = trajectory[i].x;
				positions[i * 3 + 1] = trajectory[i].y;
				positions[i * 3 + 2] = trajectory[i].z;
			}
			const lineGeo = new THREE.BufferGeometry();
			lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
			lineGeo.setAttribute(
				'color',
				new THREE.BufferAttribute(colorArrayFor(trajectory, colorMode), 3)
			);
			line = new THREE.Line(lineGeo, lineMaterial);
			scene.add(line);

			const section = computePoincareSection(trajectory, poincarePlane);
			const pPos = new Float32Array(section.length * 3);
			for (let i = 0; i < section.length; i++) {
				pPos[i * 3] = section[i].u;
				pPos[i * 3 + 1] = section[i].v;
				pPos[i * 3 + 2] = 0;
			}
			const pGeo = new THREE.BufferGeometry();
			pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
			points = new THREE.Points(pGeo, pointsMaterial);
			points.visible = false;
			scene.add(points);
		};

		function frameBounds(uvs: Array<[number, number]>): { cx: number; cy: number } {
			let minU = Infinity;
			let maxU = -Infinity;
			let minV = Infinity;
			let maxV = -Infinity;
			for (const [u, v] of uvs) {
				if (u < minU) minU = u;
				if (u > maxU) maxU = u;
				if (v < minV) minV = v;
				if (v > maxV) maxV = v;
			}
			if (!Number.isFinite(minU)) {
				minU = -10;
				maxU = 10;
				minV = -10;
				maxV = 10;
			}
			const cx = (minU + maxU) / 2;
			const cy = (minV + maxV) / 2;
			const aspect = el.clientWidth / el.clientHeight || 1;
			let halfU = (maxU - minU || 1) * 0.55;
			let halfV = (maxV - minV || 1) * 0.55;
			if (halfU / halfV < aspect) halfU = halfV * aspect;
			else halfV = halfU / aspect;
			ortho.left = cx - halfU;
			ortho.right = cx + halfU;
			ortho.top = cy + halfV;
			ortho.bottom = cy - halfV;
			ortho.near = 0.1;
			ortho.far = 2000;
			ortho.updateProjectionMatrix();
			return { cx, cy };
		}

		applyView = () => {
			if (!line || !points) return;
			if (viewMode === '3d') {
				activeCamera = persp;
				line.visible = true;
				points.visible = false;
				orbit.enabled = true;
				orbit.autoRotate = !compareMode;
				return;
			}
			orbit.enabled = false;
			orbit.autoRotate = false;

			if (viewMode === 'poincare') {
				line.visible = false;
				points.visible = true;
				const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
				const uvs: Array<[number, number]> = [];
				for (let i = 0; i < attr.count; i++) uvs.push([attr.getX(i), attr.getY(i)]);
				const { cx, cy } = frameBounds(uvs);
				ortho.up.set(0, 1, 0);
				ortho.position.set(cx, cy, 100);
				ortho.lookAt(cx, cy, 0);
				activeCamera = ortho;
				return;
			}

			line.visible = true;
			points.visible = false;
			const uvs: Array<[number, number]> = [];
			for (const p of trajectory) {
				if (viewMode === 'xy') uvs.push([p.x, p.y]);
				else if (viewMode === 'xz') uvs.push([p.x, p.z]);
				else uvs.push([p.y, p.z]);
			}
			const { cx, cy } = frameBounds(uvs);
			if (viewMode === 'xy') {
				ortho.up.set(0, 1, 0);
				ortho.position.set(cx, cy, 100);
				ortho.lookAt(cx, cy, 0);
			} else if (viewMode === 'xz') {
				ortho.up.set(0, 0, 1);
				ortho.position.set(cx, 100, cy);
				ortho.lookAt(cx, 0, cy);
			} else {
				ortho.up.set(0, 0, 1);
				ortho.position.set(100, cx, cy);
				ortho.lookAt(0, cx, cy);
			}
			activeCamera = ortho;
		};

		rebuild();
		applyView();

		const grid = new THREE.GridHelper(60, 20, 0x00f3ff, 0x2d1b69);
		grid.position.y = -15;
		(grid.material as THREE.Material).transparent = true;
		(grid.material as THREE.Material).opacity = 0.15;
		scene.add(grid);

		function animate() {
			if (!isAnimating) return;
			animationFrameId = requestAnimationFrame(animate);
			if (orbit.enabled) orbit.update();
			renderer.render(scene, activeCamera);
		}
		animate();

		const handleResize = () => {
			persp.aspect = el.clientWidth / el.clientHeight;
			persp.updateProjectionMatrix();
			renderer.setSize(el.clientWidth, el.clientHeight);
			applyView?.();
		};
		window.addEventListener('resize', handleResize);
		const resizeObserver = new ResizeObserver(() => handleResize());
		resizeObserver.observe(el);

		const disposeMaterial = (material: THREE.Material) => material.dispose();

		return () => {
			isAnimating = false;
			if (animationFrameId !== null) {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = null;
			}
			window.removeEventListener('resize', handleResize);
			resizeObserver.disconnect();
			if (cameraChangeHandler) orbit.removeEventListener('change', cameraChangeHandler);
			orbit.dispose();
			disposeObjects();
			scene.remove(grid);
			grid.geometry.dispose();
			if (Array.isArray(grid.material)) grid.material.forEach(disposeMaterial);
			else disposeMaterial(grid.material);
			lineMaterial.dispose();
			pointsMaterial.dispose();
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
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative backdrop-blur-md"
	style="height: {height}px;"
>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Orbitron'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		CHUA_RENDERER
	</div>
</div>
```

- [ ] **Step 2: Type-check**

Run: `bun run check`
Expected: PASS (no type errors). Fix any reported issues before committing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/visualizations/ChuaRenderer.svelte
git commit -m "feat(chua): add Three.js renderer with view and color modes"
```

---

## Task 8: `/chua` route page

**Files:**

- Create: `src/routes/chua/+page.svelte`
- Modify: `src/routes/visualization-pages.vitest.ts`

- [ ] **Step 1: Create the page**

Create `src/routes/chua/+page.svelte`:

```svelte
<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import SaveConfigDialog from '$lib/components/ui/SaveConfigDialog.svelte';
	import ShareDialog from '$lib/components/ui/ShareDialog.svelte';
	import SnapshotButton from '$lib/components/ui/SnapshotButton.svelte';
	import VisualizationAlerts from '$lib/components/ui/VisualizationAlerts.svelte';
	import ChuaRenderer from '$lib/components/visualizations/ChuaRenderer.svelte';
	import { checkParameterStability } from '$lib/chaos-validation';
	import { useConfigLoader, createInitialConfigLoaderState } from '$lib/use-config-loader';
	import { createSaveHandler, createInitialSaveState } from '$lib/use-visualization-save';
	import { createShareHandler, createInitialShareState } from '$lib/use-visualization-share';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { estimateLargestLyapunov, type PoincarePlane } from '$lib/chua';
	import type { ChuaParameters } from '$lib/types';
	import { buildComparisonUrl, createComparisonStateFromCurrent } from '$lib/comparison-url-state';
	import { VIZ_CONTAINER_HEIGHT, DEBOUNCE_MS } from '$lib/constants';

	let { data } = $props();

	let rendererContainer: HTMLDivElement | undefined = $state();

	// Math parameters (saved / shared / validated).
	let alpha = $state(15.6);
	let beta = $state(28);
	let gamma = $state(0);
	let a = $state(-8 / 7);
	let b = $state(-5 / 7);

	// Session-only controls.
	let dt = $state(0.005);
	let trailLength = $state(30000);
	let colorMode = $state<'time' | 'velocity' | 'z-height'>('time');
	let transientRemoval = $state(false);
	let viewMode = $state<'3d' | 'xy' | 'xz' | 'yz' | 'poincare'>('3d');
	let poincarePlane = $state<PoincarePlane>('y=0');

	// Lyapunov readout.
	let lyapunovValue = $state(0);
	let lyapunovClass = $state<'chaotic' | 'marginal' | 'stable'>('chaotic');

	const saveState = $state(createInitialSaveState());
	const shareState = $state(createInitialShareState());
	const configState = $state(createInitialConfigLoaderState());

	function getParameters(): ChuaParameters {
		return { type: 'chua', alpha, beta, gamma, a, b };
	}

	const presets = [
		{ name: 'Classic Double Scroll', alpha: 15.6, beta: 28, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'Periodic Orbit', alpha: 15.6, beta: 33, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'One-Lobe Spiral', alpha: 8.0, beta: 14.3, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'Parameter Sweep', alpha: 15.6, beta: 25, gamma: 0, a: -8 / 7, b: -5 / 7 },
		{ name: 'Experimental / Unstable', alpha: 20, beta: 10, gamma: 0.2, a: -1.2, b: -0.6 }
	] as const;

	function applyPreset(p: (typeof presets)[number]) {
		alpha = p.alpha;
		beta = p.beta;
		gamma = p.gamma;
		a = p.a;
		b = p.b;
	}

	const viewModes: Array<{ id: typeof viewMode; label: string }> = [
		{ id: '3d', label: '3D' },
		{ id: 'xy', label: 'XY' },
		{ id: 'xz', label: 'XZ' },
		{ id: 'yz', label: 'YZ' },
		{ id: 'poincare', label: 'POINCARÉ' }
	];

	// Debounced Lyapunov recompute (capped step count for responsiveness).
	const lyapUpdater = useDebouncedEffect(() => {
		const est = estimateLargestLyapunov({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: Math.min(trailLength, 20000),
			dt,
			alpha,
			beta,
			gamma,
			a,
			b
		});
		lyapunovValue = est.value;
		lyapunovClass = est.classification;
	}, DEBOUNCE_MS);

	$effect(() => {
		void alpha;
		void beta;
		void gamma;
		void a;
		void b;
		void dt;
		void trailLength;
		lyapUpdater.trigger();
	});

	let comparisonUrl = $state('');
	$effect(() => {
		void alpha;
		void beta;
		void gamma;
		void a;
		void b;
		comparisonUrl = buildComparisonUrl(
			base,
			'chua',
			createComparisonStateFromCurrent('chua', getParameters())
		);
	});

	const { save: handleSave, cleanup: cleanupSaveHandler } = createSaveHandler(
		'chua',
		saveState,
		getParameters
	);
	const { share: handleShare, cleanup: cleanupShareHandler } = createShareHandler(
		'chua',
		shareState,
		getParameters
	);

	$effect(() => {
		const { cleanup } = useConfigLoader(
			{
				page,
				mapType: 'chua',
				base,
				onParametersLoaded: (params) => {
					alpha = params.alpha;
					beta = params.beta;
					gamma = params.gamma;
					a = params.a;
					b = params.b;
					return { type: 'chua', alpha, beta, gamma, a, b };
				},
				onCheckStability: (params) => checkParameterStability('chua', params)
			},
			configState
		);
		return cleanup;
	});

	$effect(() => {
		return () => {
			cleanupSaveHandler();
			cleanupShareHandler();
			lyapUpdater.cleanup();
		};
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between border-b border-primary/20 pb-4">
		<div>
			<h1
				class="text-4xl font-['Orbitron'] font-bold text-primary tracking-wider drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]"
			>
				CHUA_CIRCUIT
			</h1>
			<p class="text-muted-foreground mt-2 font-light tracking-wide">
				CHAOTIC_SYSTEM_VISUALIZATION // MODULE_12
			</p>
		</div>
		<div class="flex gap-3">
			<SnapshotButton target={rendererContainer} targetType="container" mapType="chua" />
			{#if comparisonUrl}
				<a
					href={comparisonUrl}
					class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
				>
					⊞ Compare
				</a>
			{/if}
			<button
				onclick={() => (shareState.showShareDialog = true)}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				🔗 Share
			</button>
			<button
				onclick={() => (saveState.showSaveDialog = true)}
				class="px-6 py-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				💾 Save
			</button>
			<a
				href={base + '/'}
				class="px-6 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-sm transition-all hover:shadow-[0_0_15px_rgba(0,243,255,0.2)] uppercase tracking-widest text-sm font-bold"
			>
				← Return
			</a>
		</div>
	</div>

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

	<!-- Control Panel -->
	<div
		class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden"
	>
		<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
		<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
		<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
		<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

		<h2 class="text-xl font-['Orbitron'] font-semibold text-primary flex items-center gap-2">
			<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
			SYSTEM_PARAMETERS
		</h2>

		<!-- Presets -->
		<div class="flex flex-wrap gap-2">
			{#each presets as preset (preset.name)}
				<button
					onclick={() => applyPreset(preset)}
					class="px-3 py-1.5 bg-primary/5 hover:bg-primary/20 text-primary/90 border border-primary/30 rounded-sm transition-all uppercase tracking-wider text-xs font-bold"
				>
					{preset.name}
				</button>
			{/each}
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="alpha" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						α (alpha)
					</label>
					<span class="font-mono text-accent">{alpha.toFixed(2)}</span>
				</div>
				<input
					id="alpha"
					type="range"
					bind:value={alpha}
					min="0"
					max="25"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="beta" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						β (beta)
					</label>
					<span class="font-mono text-accent">{beta.toFixed(2)}</span>
				</div>
				<input
					id="beta"
					type="range"
					bind:value={beta}
					min="0"
					max="55"
					step="0.1"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="gamma" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						γ (gamma)
					</label>
					<span class="font-mono text-accent">{gamma.toFixed(2)}</span>
				</div>
				<input
					id="gamma"
					type="range"
					bind:value={gamma}
					min="-1"
					max="1"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="a" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						a (m₀)
					</label>
					<span class="font-mono text-accent">{a.toFixed(3)}</span>
				</div>
				<input
					id="a"
					type="range"
					bind:value={a}
					min="-2"
					max="0"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="b" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						b (m₁)
					</label>
					<span class="font-mono text-accent">{b.toFixed(3)}</span>
				</div>
				<input
					id="b"
					type="range"
					bind:value={b}
					min="-1.5"
					max="0"
					step="0.01"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="dt" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						dt (step)
					</label>
					<span class="font-mono text-accent">{dt.toFixed(4)}</span>
				</div>
				<input
					id="dt"
					type="range"
					bind:value={dt}
					min="0.001"
					max="0.02"
					step="0.001"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<div class="flex justify-between items-end">
					<label for="trail" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
						Trail Length
					</label>
					<span class="font-mono text-accent">{trailLength.toLocaleString()}</span>
				</div>
				<input
					id="trail"
					type="range"
					bind:value={trailLength}
					min="5000"
					max="100000"
					step="1000"
					class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
				/>
			</div>

			<div class="space-y-2">
				<label for="colorMode" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
					Color By
				</label>
				<select
					id="colorMode"
					bind:value={colorMode}
					class="w-full bg-black/40 text-primary border border-primary/30 rounded-sm px-2 py-1 text-sm"
				>
					<option value="time">Time</option>
					<option value="velocity">Velocity</option>
					<option value="z-height">Z-Height</option>
				</select>
			</div>

			<div class="space-y-2">
				<label class="text-primary/80 text-xs uppercase tracking-widest font-bold" for="transient">
					Transient Removal
				</label>
				<label class="flex items-center gap-2 text-sm text-muted-foreground">
					<input
						id="transient"
						type="checkbox"
						bind:checked={transientRemoval}
						class="accent-primary"
					/>
					Discard initial transient
				</label>
			</div>
		</div>

		{#if viewMode === 'poincare'}
			<div class="space-y-2 max-w-xs">
				<label for="plane" class="text-primary/80 text-xs uppercase tracking-widest font-bold">
					Poincaré Plane
				</label>
				<select
					id="plane"
					bind:value={poincarePlane}
					class="w-full bg-black/40 text-primary border border-primary/30 rounded-sm px-2 py-1 text-sm"
				>
					<option value="x=0">x = 0</option>
					<option value="y=0">y = 0</option>
					<option value="z=0">z = 0</option>
				</select>
			</div>
		{/if}

		<div
			class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
		>
			<p>dx/dt = α(y − x − f(x))</p>
			<p>dy/dt = x − y + z</p>
			<p>dz/dt = −(βy + γz)</p>
			<p class="md:col-span-3">f(x) = b·x + ½(a − b)(|x+1| − |x−1|)</p>
		</div>
	</div>

	<!-- View mode toggle -->
	<div class="flex flex-wrap gap-2">
		{#each viewModes as mode (mode.id)}
			<button
				onclick={() => (viewMode = mode.id)}
				class="px-4 py-1.5 border rounded-sm uppercase tracking-widest text-xs font-bold transition-all {viewMode ===
				mode.id
					? 'bg-primary/20 text-primary border-primary'
					: 'bg-primary/5 text-primary/70 border-primary/30 hover:bg-primary/15'}"
			>
				{mode.label}
			</button>
		{/each}
	</div>

	<ChuaRenderer
		bind:containerElement={rendererContainer}
		bind:alpha
		bind:beta
		bind:gamma
		bind:a
		bind:b
		{dt}
		{trailLength}
		{viewMode}
		{colorMode}
		{transientRemoval}
		{poincarePlane}
		height={VIZ_CONTAINER_HEIGHT}
	/>

	<!-- Lyapunov readout strip -->
	<div
		class="flex items-center gap-6 bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm px-6 py-3 font-mono text-sm"
	>
		<span class="text-primary/80 uppercase tracking-widest text-xs font-bold">Analysis</span>
		<span class="text-accent">λₘₐₓ ≈ {lyapunovValue.toFixed(3)}</span>
		<span
			class="uppercase tracking-wider text-xs {lyapunovClass === 'chaotic'
				? 'text-fuchsia-400'
				: lyapunovClass === 'stable'
					? 'text-emerald-400'
					: 'text-yellow-400'}"
		>
			{lyapunovClass}
		</span>
	</div>

	<!-- Info Panel -->
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">
			DATA_LOG: CHUA_CIRCUIT
		</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">
			The Chua circuit is one of the simplest electronic circuits capable of chaos. Its state
			spirals between two equilibrium lobes, tracing the famous double-scroll attractor. The
			nonlinear Chua diode — a piecewise-linear resistor with negative slopes — drives the rich
			bifurcation structure of this 3D system.
		</p>
	</div>
</div>

<SaveConfigDialog
	bind:open={saveState.showSaveDialog}
	mapType="chua"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (saveState.showSaveDialog = false)}
	onSave={handleSave}
/>

<ShareDialog
	bind:open={shareState.showShareDialog}
	mapType="chua"
	isAuthenticated={!!data?.session}
	currentPath={$page.url.pathname}
	onClose={() => (shareState.showShareDialog = false)}
	onShare={handleShare}
/>
```

- [ ] **Step 2: Register the page in `visualization-pages.vitest.ts`**

In `src/routes/visualization-pages.vitest.ts`:

Add the import (after the `ChaosEsthetiquePage` import):

```ts
import ChuaPage from './chua/+page.svelte';
import ChuaComparePage from './chua/compare/+page.svelte';
```

Add the renderer mock (after the `RosslerRenderer` mock block):

```ts
vi.mock('$lib/components/visualizations/ChuaRenderer.svelte', async () => {
	const module = await import('$lib/components/testing/StubComponent.svelte');
	return { default: module.default };
});
```

Add the render test (after the `renders chaos esthetique page` test):

```ts
it('renders chua page', () => {
	setPageUrl('http://localhost/chua');
	render(ChuaPage, { props: pageProps });
	expect(screen.getByText('CHUA_CIRCUIT')).toBeInTheDocument();
});
```

Add the compare render test (after the `renders standard compare page` test):

```ts
it('renders chua compare page', () => {
	setPageUrl('http://localhost/chua/compare?compare=true');
	render(ChuaComparePage);
	expect(screen.getByText('LEFT_PARAMETERS')).toBeInTheDocument();
	expect(screen.getByText('RIGHT_PARAMETERS')).toBeInTheDocument();
});
```

Add two entries to the `dialogTestCases` array (after the last existing entry, mind the trailing comma):

```ts
		{
			action: 'save',
			pageName: 'chua',
			url: 'http://localhost/chua',
			dialogTestId: 'dialog-close-chua',
			renderPage: () => render(ChuaPage, { props: pageProps })
		},
		{
			action: 'share',
			pageName: 'chua',
			url: 'http://localhost/chua',
			dialogTestId: 'dialog-close-chua',
			renderPage: () => render(ChuaPage, { props: pageProps })
		}
```

> Note: the `renders chua compare page` test and the import of `ChuaComparePage` will fail until Task 9 creates the compare page. Run the page render + dialog tests now; the compare test goes green after Task 9. (If running task-by-task strictly, comment out the compare import/test, then restore in Task 9.)

- [ ] **Step 3: Run the page check + tests**

Run: `bun run check && bun run test:unit -- src/routes/visualization-pages.vitest.ts`
Expected: `check` PASS; vitest PASS for the chua page render + dialog cases (compare test pending Task 9).

- [ ] **Step 4: Commit**

```bash
git add src/routes/chua/+page.svelte src/routes/visualization-pages.vitest.ts
git commit -m "feat(chua): add /chua route page with full controls"
```

---

## Task 9: `/chua/compare` route page

**Files:**

- Create: `src/routes/chua/compare/+page.svelte`

- [ ] **Step 1: Create the compare page**

Create `src/routes/chua/compare/+page.svelte`:

```svelte
<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import ChuaRenderer from '$lib/components/visualizations/ChuaRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { isChuaParameters } from '$lib/type-guards';
	import { useDebouncedEffect } from '$lib/use-debounced-effect';
	import { DEBOUNCE_MS } from '$lib/constants';
	import type { ChuaParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'chua');
	const defaultParams = getDefaultParameters('chua') as ChuaParameters;

	const leftParams = initialState?.left;
	const rightParams = initialState?.right;

	let leftAlpha = $state(
		leftParams && isChuaParameters(leftParams) ? leftParams.alpha : defaultParams.alpha
	);
	let leftBeta = $state(
		leftParams && isChuaParameters(leftParams) ? leftParams.beta : defaultParams.beta
	);
	let leftGamma = $state(
		leftParams && isChuaParameters(leftParams) ? leftParams.gamma : defaultParams.gamma
	);
	let leftA = $state(leftParams && isChuaParameters(leftParams) ? leftParams.a : defaultParams.a);
	let leftB = $state(leftParams && isChuaParameters(leftParams) ? leftParams.b : defaultParams.b);

	let rightAlpha = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.alpha : defaultParams.alpha
	);
	let rightBeta = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.beta : defaultParams.beta
	);
	let rightGamma = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.gamma : defaultParams.gamma
	);
	let rightA = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.a : defaultParams.a
	);
	let rightB = $state(
		rightParams && isChuaParameters(rightParams) ? rightParams.b : defaultParams.b
	);

	function buildState() {
		return {
			compare: true as const,
			left: {
				type: 'chua' as const,
				alpha: leftAlpha,
				beta: leftBeta,
				gamma: leftGamma,
				a: leftA,
				b: leftB
			},
			right: {
				type: 'chua' as const,
				alpha: rightAlpha,
				beta: rightBeta,
				gamma: rightGamma,
				a: rightA,
				b: rightB
			}
		};
	}

	const urlUpdater = useDebouncedEffect(() => {
		goto(`${base}/chua/compare?${encodeComparisonState(buildState())}`, {
			replaceState: true,
			noScroll: true
		});
	}, DEBOUNCE_MS);

	let initialized = false;
	$effect(() => {
		void leftAlpha;
		void leftBeta;
		void leftGamma;
		void leftA;
		void leftB;
		void rightAlpha;
		void rightBeta;
		void rightGamma;
		void rightA;
		void rightB;
		if (!initialized) {
			initialized = true;
			return;
		}
		urlUpdater.trigger();
	});

	onDestroy(() => {
		urlUpdater.cleanup();
	});

	onMount(() => {
		if ($page.url.searchParams.get('compare') !== 'true') {
			goto(`${base}/chua/compare?${encodeComparisonState(buildState())}`, {
				replaceState: true,
				noScroll: true
			});
		}
	});

	function getLeftParams(): ChuaParameters {
		return { type: 'chua', alpha: leftAlpha, beta: leftBeta, gamma: leftGamma, a: leftA, b: leftB };
	}
	function getRightParams(): ChuaParameters {
		return {
			type: 'chua',
			alpha: rightAlpha,
			beta: rightBeta,
			gamma: rightGamma,
			a: rightA,
			b: rightB
		};
	}
	function handleLeftParamsChange(params: ChuaParameters) {
		leftAlpha = params.alpha;
		leftBeta = params.beta;
		leftGamma = params.gamma;
		leftA = params.a;
		leftB = params.b;
	}
	function handleRightParamsChange(params: ChuaParameters) {
		rightAlpha = params.alpha;
		rightBeta = params.beta;
		rightGamma = params.gamma;
		rightA = params.a;
		rightB = params.b;
	}
</script>

<ComparisonLayout
	mapType="chua"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={true}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as ChuaParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as ChuaParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-alpha"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">α (alpha)</label
							>
							<span class="font-mono text-accent text-sm">{leftAlpha.toFixed(2)}</span>
						</div>
						<input
							id="left-alpha"
							type="range"
							bind:value={leftAlpha}
							min="0"
							max="25"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-beta"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">β (beta)</label
							>
							<span class="font-mono text-accent text-sm">{leftBeta.toFixed(2)}</span>
						</div>
						<input
							id="left-beta"
							type="range"
							bind:value={leftBeta}
							min="0"
							max="55"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-gamma"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">γ (gamma)</label
							>
							<span class="font-mono text-accent text-sm">{leftGamma.toFixed(2)}</span>
						</div>
						<input
							id="left-gamma"
							type="range"
							bind:value={leftGamma}
							min="-1"
							max="1"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a (m₀)</label
							>
							<span class="font-mono text-accent text-sm">{leftA.toFixed(3)}</span>
						</div>
						<input
							id="left-a"
							type="range"
							bind:value={leftA}
							min="-2"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b (m₁)</label
							>
							<span class="font-mono text-accent text-sm">{leftB.toFixed(3)}</span>
						</div>
						<input
							id="left-b"
							type="range"
							bind:value={leftB}
							min="-1.5"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = α(y − x − f(x))</p>
					<p>dy/dt = x − y + z</p>
					<p>dz/dt = −(βy + γz)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<ChuaRenderer
				bind:alpha={leftAlpha}
				bind:beta={leftBeta}
				bind:gamma={leftGamma}
				bind:a={leftA}
				bind:b={leftB}
				height={400}
				compareMode={true}
				compareSide="left"
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="space-y-3">
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-alpha"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">α (alpha)</label
							>
							<span class="font-mono text-accent text-sm">{rightAlpha.toFixed(2)}</span>
						</div>
						<input
							id="right-alpha"
							type="range"
							bind:value={rightAlpha}
							min="0"
							max="25"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-beta"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">β (beta)</label
							>
							<span class="font-mono text-accent text-sm">{rightBeta.toFixed(2)}</span>
						</div>
						<input
							id="right-beta"
							type="range"
							bind:value={rightBeta}
							min="0"
							max="55"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-gamma"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">γ (gamma)</label
							>
							<span class="font-mono text-accent text-sm">{rightGamma.toFixed(2)}</span>
						</div>
						<input
							id="right-gamma"
							type="range"
							bind:value={rightGamma}
							min="-1"
							max="1"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-a"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">a (m₀)</label
							>
							<span class="font-mono text-accent text-sm">{rightA.toFixed(3)}</span>
						</div>
						<input
							id="right-a"
							type="range"
							bind:value={rightA}
							min="-2"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-b"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">b (m₁)</label
							>
							<span class="font-mono text-accent text-sm">{rightB.toFixed(3)}</span>
						</div>
						<input
							id="right-b"
							type="range"
							bind:value={rightB}
							min="-1.5"
							max="0"
							step="0.01"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-accent transition-colors"
						/>
					</div>
				</div>
				{#snippet equations()}
					<p>dx/dt = α(y − x − f(x))</p>
					<p>dy/dt = x − y + z</p>
					<p>dz/dt = −(βy + γz)</p>
				{/snippet}
			</ComparisonParameterPanel>

			<ChuaRenderer
				bind:alpha={rightAlpha}
				bind:beta={rightBeta}
				bind:gamma={rightGamma}
				bind:a={rightA}
				bind:b={rightB}
				height={400}
				compareMode={true}
				compareSide="right"
			/>
		</div>
	{/snippet}
</ComparisonLayout>
```

- [ ] **Step 2: Run check + the compare vitest**

Run: `bun run check && bun run test:unit -- src/routes/visualization-pages.vitest.ts`
Expected: `check` PASS; the `renders chua compare page` test now PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/chua/compare/+page.svelte
git commit -m "feat(chua): add /chua/compare comparison page"
```

---

## Task 10: Landing page card

**Files:**

- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page.vitest.ts`

- [ ] **Step 1: Update the landing-page test (failing first)**

In `src/routes/page.vitest.ts`:

Change the card-count test:

```ts
it('renders all 12 visualization cards', () => {
	render(Page);
	const links = screen.getAllByRole('link');
	expect(links).toHaveLength(12);
});
```

Add Chua to the `visualizations` array used by the per-card tests (after the `Lyapunov Exponents` entry):

```ts
		{ name: 'Lyapunov Exponents', url: '/lyapunov' },
		{ name: 'Chua Circuit', url: '/chua' }
```

Change the CTA count test:

```ts
it('renders "Initialize Module" call-to-action on each card', () => {
	render(Page);
	const ctaElements = screen.getAllByText('Initialize Module');
	expect(ctaElements).toHaveLength(12);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit -- src/routes/page.vitest.ts`
Expected: FAIL — only 11 cards present.

- [ ] **Step 3: Add the card to `+page.svelte`**

In `src/routes/+page.svelte`, add to the `visualizations` array (after the `Lyapunov Exponents` entry):

```ts
		{
			name: 'Lyapunov Exponents',
			description: 'Quantifying chaos through trajectory divergence rates',
			url: '/lyapunov',
			color: 'from-cyan-400 to-teal-600'
		},
		{
			name: 'Chua Circuit',
			description:
				'A nonlinear circuit model whose state spirals between two lobes, producing the classic double-scroll attractor',
			url: '/chua',
			color: 'from-red-500 to-amber-600'
		}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit -- src/routes/page.vitest.ts`
Expected: PASS (12 cards, chua card present with `/chua` href).

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte src/routes/page.vitest.ts
git commit -m "feat(chua): add Chua Circuit card to landing page"
```

---

## Task 11: Full verification + docs

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md` project overview**

In `CLAUDE.md`, update the Project Overview sentence to include Chua and the new count. Change:

```
visualizes 11 different chaos theory mathematical systems (Lorenz, Rössler, Hénon, Lozi, Logistic, Newton, Standard, Bifurcation-Logistic, Bifurcation-Hénon, Chaos Esthetique, Lyapunov).
```

to:

```
visualizes 12 different chaos theory mathematical systems (Lorenz, Rössler, Hénon, Lozi, Logistic, Newton, Standard, Bifurcation-Logistic, Bifurcation-Hénon, Chaos Esthetique, Lyapunov, Chua).
```

- [ ] **Step 2: Run the full test + quality suite**

Run each and confirm output:

```bash
bun test                 # Bun unit tests — includes chua.test.ts, chua-validation.test.ts, types.test.ts
bun run test:unit        # Vitest — includes visualization-pages.vitest.ts, page.vitest.ts
bun run check            # svelte-check — zero errors
bun run lint             # ESLint + Prettier — clean
```

Expected: all green. If `bun run check` reports an exhaustive-switch error over `ChaosMapType` in a file not yet touched (e.g. `src/lib/server/share-utils.ts`), open it, find the `switch (mapType)` and add a `case 'chua':` branch mirroring the `rossler` branch (or extend the relevant `Record<ChaosMapType, …>`). Re-run until clean.

- [ ] **Step 3: Manual visual check (Three.js renderer)**

Run: `bun run dev` and open `http://localhost:5173/chua`. Confirm:

- The 3D double scroll renders and auto-rotates with classic defaults.
- Each preset button changes the attractor.
- `[XY] [XZ] [YZ]` show flat projections; `[POINCARÉ]` shows a point scatter and reveals the plane selector.
- Color-by `velocity` / `z-height` recolor the trail; transient-removal toggle trims the start.
- The λₘₐₓ readout is positive (~0.2–0.4) for the Classic preset and updates with sliders.
- `⊞ Compare` opens `/chua/compare` with two synced 3D views.
- 💾 Save and 🔗 Share dialogs open.

Adjust ortho camera `up`/sign or `frameBounds` padding if any 2D projection looks mirrored or poorly framed — these are cosmetic and safe to tune.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note Chua circuit module (12 systems)"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** §2 math → Tasks 1–4. §3 architecture → Task 7. §4 files → all tasks. §5 solver → Tasks 1–4. §6 renderer view/color/transient → Task 7. §7 control panel/presets/Lyapunov → Task 8. §8 registries → Tasks 5, 6, 10. §9 save/share/URL/compare → Tasks 8, 9. §10 testing → Tasks 1–6, 8–11. §11 out-of-scope respected (no worker, no animated sweep, session-only UI state).
- **Preset / range tuning:** Preset values and `STABLE_RANGES` bounds are starting points (spec §7). If a preset looks wrong in Step 3 of Task 11, tune the constants in `presets` (Task 8) and `STABLE_RANGES.chua` (Task 6); keep `Classic Double Scroll` = `getDefaultParameters('chua')`.
- **Lyapunov test robustness:** if `classic.value > 0` is ever flaky, raise `steps` in the Task 4 test to 12000.
- **Naming consistency:** solver field names are `alpha/beta/gamma/a/b` everywhere (type, validation ranges, defaults, page, renderer, compare). Poincaré coords are `u/v`. View modes are `'3d' | 'xy' | 'xz' | 'yz' | 'poincare'`.
