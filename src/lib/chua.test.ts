import { describe, expect, test } from 'vitest';
import {
	chuaDiode,
	calculateChua,
	computePoincareSection,
	estimateLargestLyapunov,
	classifyLyapunov
} from './chua';

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

	test('returns array of the requested length when not diverged', () => {
		const result = calculateChua({ ...base, steps: 100 });
		expect(result.diverged).toBe(false);
		expect(result.points).toHaveLength(100);
	});

	test('handles zero steps', () => {
		const result = calculateChua({ ...base, steps: 0 });
		expect(result.diverged).toBe(false);
		expect(result.points).toHaveLength(0);
	});

	test('all points are finite', () => {
		const result = calculateChua({ ...base, steps: 500 });
		expect(result.diverged).toBe(false);
		for (const p of result.points) {
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

		const result = calculateChua({ ...base, steps: 1 });
		expect(result.points[0].x).toBeCloseTo(expectedX, 10);
		expect(result.points[0].y).toBeCloseTo(expectedY, 10);
		expect(result.points[0].z).toBeCloseTo(expectedZ, 10);
	});

	test('classic parameters stay bounded (double-scroll attractor)', () => {
		const result = calculateChua({ ...base, steps: 20000 });
		expect(result.diverged).toBe(false);
		for (const p of result.points) {
			expect(Math.abs(p.x)).toBeLessThan(50);
			expect(Math.abs(p.y)).toBeLessThan(50);
			expect(Math.abs(p.z)).toBeLessThan(50);
		}
	});

	test('is deterministic for identical input', () => {
		const r1 = calculateChua({ ...base, steps: 300 });
		const r2 = calculateChua({ ...base, steps: 300 });
		expect(r1.points[299]).toEqual(r2.points[299]);
	});

	test('detects divergence and returns partial finite trajectory', () => {
		// Slider-reachable parameters that cause blow-up: large alpha, zero beta,
		// negative gamma, extreme slopes, and large dt.
		const result = calculateChua({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 50000,
			dt: 0.02,
			alpha: 25,
			beta: 0,
			gamma: -1,
			a: -2,
			b: -1.5
		});
		expect(result.diverged).toBe(true);
		// Partial trajectory should contain only finite points
		expect(result.points.length).toBeGreaterThan(0);
		expect(result.points.length).toBeLessThan(50000);
		for (const p of result.points) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
			expect(Number.isFinite(p.z)).toBe(true);
		}
	});

	test('diverged result never contains NaN or Infinity', () => {
		const result = calculateChua({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 100000,
			dt: 0.02,
			alpha: 25,
			beta: 0.1,
			gamma: 0,
			a: -2,
			b: -1.5
		});
		for (const p of result.points) {
			expect(Number.isFinite(p.x)).toBe(true);
			expect(Number.isFinite(p.y)).toBe(true);
			expect(Number.isFinite(p.z)).toBe(true);
		}
	});
});

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

	test('asymmetric crossing interpolates at correct t (not always 0.5)', () => {
		// y goes from -3 to +1: crossing at t = 3/4, not 0.5.
		// In-plane coords for y=0 are (x, z).
		const pts = [
			{ x: 0, y: -3, z: 0 },
			{ x: 4, y: 1, z: 8 }
		];
		const section = computePoincareSection(pts, 'y=0');
		expect(section).toHaveLength(1);
		expect(section[0].u).toBeCloseTo(3, 10); // x = 0 + (4-0) * 0.75 = 3
		expect(section[0].v).toBeCloseTo(6, 10); // z = 0 + (8-0) * 0.75 = 6
	});

	test('skips crossings with non-finite normal values', () => {
		const pts = [
			{ x: 0, y: -1, z: 0 },
			{ x: 2, y: NaN, z: 0 },
			{ x: 4, y: 1, z: 0 }
		];
		// The NaN point should not produce a crossing; the -1 -> 1 pair is valid
		// but they are not consecutive (NaN sits between them).
		expect(computePoincareSection(pts, 'y=0')).toHaveLength(0);
	});

	test('skips crossings with NaN/Infinity denominator', () => {
		const pts = [
			{ x: 0, y: -1, z: 0 },
			{ x: 2, y: Infinity, z: 0 }
		];
		expect(computePoincareSection(pts, 'y=0')).toHaveLength(0);
	});
});

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
		expect(est.diverged).toBe(false);
	});

	test('is deterministic', () => {
		const a = estimateLargestLyapunov(base);
		const b = estimateLargestLyapunov(base);
		expect(a.value).toBe(b.value);
	});

	test('strong damping lowers the exponent', () => {
		const damped = estimateLargestLyapunov({ ...base, gamma: 5 });
		const classic = estimateLargestLyapunov(base);
		expect(damped.value).toBeLessThan(classic.value);
	});

	test('returns diverged=true for divergent parameters', () => {
		const est = estimateLargestLyapunov({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 50000,
			dt: 0.02,
			alpha: 25,
			beta: 0,
			gamma: -1,
			a: -2,
			b: -1.5
		});
		expect(est.diverged).toBe(true);
		expect(Number.isNaN(est.value)).toBe(true);
		expect(est.classification).toBe('marginal');
	});

	test('handles very few steps without crashing', () => {
		const est = estimateLargestLyapunov({
			x0: 0.1,
			y0: 0,
			z0: 0,
			steps: 1,
			dt: 0.005,
			alpha: 15.6,
			beta: 28,
			gamma: 0,
			a: -8 / 7,
			b: -5 / 7
		});
		expect(est.diverged).toBe(false);
		expect(typeof est.value === 'number').toBe(true);
	});
});
