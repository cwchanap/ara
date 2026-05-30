import { describe, expect, test } from 'bun:test';
import { chuaDiode, calculateChua, computePoincareSection } from './chua';

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
