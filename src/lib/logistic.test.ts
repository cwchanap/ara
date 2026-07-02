import { describe, it, expect } from 'vitest';
import { calculateLogistic } from './logistic';

describe('calculateLogistic', () => {
	it('should return an empty array for 0 iterations', () => {
		const points = calculateLogistic(3.9, 0.1, 0);
		expect(points).toEqual([]);
	});

	it('should return a single point for 1 iteration', () => {
		const points = calculateLogistic(3.9, 0.1, 1);
		expect(points).toHaveLength(1);
		// x(0) = 3.9 * 0.1 * (1 - 0.1) = 3.9 * 0.09 = 0.351
		expect(points[0][0]).toBe(0);
		expect(points[0][1]).toBeCloseTo(0.351, 5);
	});

	it('should compute correct values for multiple iterations', () => {
		const points = calculateLogistic(3.9, 0.1, 3);
		expect(points).toHaveLength(3);

		// Manually computed:
		// i=0: x = 3.9 * 0.1 * 0.9 = 0.351
		// i=1: x = 3.9 * 0.351 * (1 - 0.351) = 3.9 * 0.351 * 0.649 = 0.8884161
		// i=2: x = 3.9 * 0.8884161 * (1 - 0.8884161) ≈ 0.3866184

		expect(points[0][0]).toBe(0);
		expect(points[0][1]).toBeCloseTo(0.351, 5);

		expect(points[1][0]).toBe(1);
		expect(points[1][1]).toBeCloseTo(0.8884161, 5);

		expect(points[2][0]).toBe(2);
		expect(points[2][1]).toBeCloseTo(0.3866184, 3);
	});

	it('should return array of [iteration, value] tuples', () => {
		const points = calculateLogistic(3.0, 0.5, 2);
		expect(Array.isArray(points)).toBe(true);
		expect(points[0]).toEqual([0, expect.any(Number)]);
		expect(points[1]).toEqual([1, expect.any(Number)]);
	});

	it('should use the logistic map recurrence: x(n+1) = r * x(n) * (1 - x(n))', () => {
		const r = 2.5;
		const x0 = 0.3;
		const iterations = 2;

		const points = calculateLogistic(r, x0, iterations);

		// Manual calculation:
		// x(0) = 2.5 * 0.3 * (1 - 0.3) = 2.5 * 0.3 * 0.7 = 0.525
		// x(1) = 2.5 * 0.525 * (1 - 0.525) = 2.5 * 0.525 * 0.475 = 0.6234375

		expect(points[0][1]).toBeCloseTo(0.525, 5);
		expect(points[1][1]).toBeCloseTo(0.6234375, 5);
	});

	it('should handle different parameter values', () => {
		// Low r value
		const points1 = calculateLogistic(1.5, 0.1, 10);
		expect(points1).toHaveLength(10);

		// High r value (chaotic)
		const points2 = calculateLogistic(4.0, 0.1, 10);
		expect(points2).toHaveLength(10);

		// Different x0
		const points3 = calculateLogistic(3.9, 0.5, 5);
		expect(points3).toHaveLength(5);
	});

	it('should be deterministic', () => {
		const points1 = calculateLogistic(3.9, 0.1, 100);
		const points2 = calculateLogistic(3.9, 0.1, 100);

		expect(points1).toEqual(points2);
	});
});
