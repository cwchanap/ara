import { describe, expect, it } from 'vitest';
import { calculateLozi, calculateLoziTuples } from './lozi';
import type { LoziParams } from './lozi';

const defaultParams: LoziParams = {
	a: 1.7,
	b: 0.5,
	x0: 0,
	y0: 0,
	iterations: 100
};

describe('calculateLozi', () => {
	it('returns an array of the correct length', () => {
		const points = calculateLozi(defaultParams);
		expect(points).toHaveLength(100);
	});

	it('returns objects with x and y properties', () => {
		const points = calculateLozi(defaultParams);
		expect(points[0]).toHaveProperty('x');
		expect(points[0]).toHaveProperty('y');
	});

	it('returns empty array when iterations is 0', () => {
		const points = calculateLozi({ ...defaultParams, iterations: 0 });
		expect(points).toHaveLength(0);
	});

	it('produces finite numbers for classic chaotic parameters', () => {
		const points = calculateLozi({ ...defaultParams, a: 1.7, b: 0.5, x0: 0, y0: 0 });
		for (const { x, y } of points) {
			expect(isFinite(x)).toBe(true);
			expect(isFinite(y)).toBe(true);
		}
	});

	it('first iteration follows the Lozi formula: xNew = 1 + y0 - a|x0|', () => {
		const a = 1.7;
		const b = 0.5;
		const x0 = 1;
		const y0 = 2;
		const points = calculateLozi({ a, b, x0, y0, iterations: 1 });
		const expectedX = 1 + y0 - a * Math.abs(x0);
		const expectedY = b * x0;
		expect(points[0].x).toBeCloseTo(expectedX, 10);
		expect(points[0].y).toBeCloseTo(expectedY, 10);
	});

	it('correctly handles negative x0', () => {
		const params = { ...defaultParams, x0: -1, y0: 0, iterations: 1 };
		const points = calculateLozi(params);
		// |x| = 1 regardless of sign
		const expectedX = 1 + 0 - 1.7 * Math.abs(-1);
		expect(points[0].x).toBeCloseTo(expectedX, 10);
	});

	it('each iteration feeds into the next', () => {
		const params = { ...defaultParams, iterations: 2 };
		const points = calculateLozi(params);
		const xAfterFirst = 1 + params.y0 - params.a * Math.abs(params.x0);
		const yAfterFirst = params.b * params.x0;
		const expectedX2 = 1 + yAfterFirst - params.a * Math.abs(xAfterFirst);
		expect(points[1].x).toBeCloseTo(expectedX2, 10);
	});

	it('works with single iteration', () => {
		const points = calculateLozi({ ...defaultParams, iterations: 1 });
		expect(points).toHaveLength(1);
	});
});

describe('calculateLoziTuples', () => {
	it('returns an array of the correct length', () => {
		const tuples = calculateLoziTuples(defaultParams);
		expect(tuples).toHaveLength(100);
	});

	it('returns [x, y] tuples (arrays of length 2)', () => {
		const tuples = calculateLoziTuples(defaultParams);
		expect(Array.isArray(tuples[0])).toBe(true);
		expect(tuples[0]).toHaveLength(2);
	});

	it('returns empty array when iterations is 0', () => {
		const tuples = calculateLoziTuples({ ...defaultParams, iterations: 0 });
		expect(tuples).toHaveLength(0);
	});

	it('produces the same numeric values as calculateLozi', () => {
		const points = calculateLozi(defaultParams);
		const tuples = calculateLoziTuples(defaultParams);
		for (let i = 0; i < points.length; i++) {
			expect(tuples[i][0]).toBeCloseTo(points[i].x, 10);
			expect(tuples[i][1]).toBeCloseTo(points[i].y, 10);
		}
	});

	it('first iteration follows the Lozi formula', () => {
		const a = 1.7;
		const b = 0.5;
		const x0 = 1;
		const y0 = 2;
		const tuples = calculateLoziTuples({ a, b, x0, y0, iterations: 1 });
		const expectedX = 1 + y0 - a * Math.abs(x0);
		const expectedY = b * x0;
		expect(tuples[0][0]).toBeCloseTo(expectedX, 10);
		expect(tuples[0][1]).toBeCloseTo(expectedY, 10);
	});
});
