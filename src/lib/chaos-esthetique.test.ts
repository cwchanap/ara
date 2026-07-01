import { describe, it, expect } from 'vitest';
import { calculateChaos, f } from './chaos-esthetique';

describe('f(x, a) helper', () => {
	it('f(1, 0) === 1', () => {
		// a=0, x=1: f(1,0) = 0·1 + (2·1·1²)/(1+1²) = 0 + 2/2 = 1
		expect(f(1, 0)).toBe(1);
	});

	it('f(2, 1) === 2', () => {
		// a=1, x=2: f(2,1) = 1·2 + (2·0·4)/(1+4) = 2 + 0 = 2
		expect(f(2, 1)).toBe(2);
	});
});

describe('calculateChaos(a, b, x0, y0, iterations, maxPoints)', () => {
	it('fixed point: calculateChaos(0, 1, 1, 0, 2, 15000)', () => {
		// a=0, b=1, x0=1, y0=0
		// Iteration 0: xNew = 0 + f(1,0) = 0 + 1 = 1, yNew = -1·1 + f(1,0) = -1 + 1 = 0 → [1,0]
		// Iteration 1: xNew = 0 + f(1,0) = 1, yNew = -1·1 + f(1,0) = 0 → [1,0]
		const pts = calculateChaos(0, 1, 1, 0, 2, 15000);
		expect(pts).toEqual([
			[1, 0],
			[1, 0]
		]);
	});

	it('linear case: calculateChaos(1, 0, 2, 3, 2, 15000)', () => {
		// a=1, b=0, x0=2, y0=3; f(x,1)=x
		// Iteration 0: xNew = 3 + f(2,1) = 3 + 2 = 5, yNew = 0·2 + f(5,1) = 0 + 5 = 5 → [5,5]
		// Iteration 1: x=5, y=5; xNew = 5 + f(5,1) = 5 + 5 = 10, yNew = 0 + f(10,1) = 0 + 10 = 10 → [10,10]
		const pts = calculateChaos(1, 0, 2, 3, 2, 15000);
		expect(pts).toEqual([
			[5, 5],
			[10, 10]
		]);
	});

	it('maxPoints cap: calculateChaos(1, 0, 2, 3, 5, 2).length === 2', () => {
		// steps = min(5, 2) = 2, so exactly 2 points should be produced
		const pts = calculateChaos(1, 0, 2, 3, 5, 2);
		expect(pts.length).toBe(2);
	});

	it('empty case: calculateChaos(1, 0, 0, 0, 0, 15000) === []', () => {
		// steps = min(0, 15000) = 0, loop never runs
		const pts = calculateChaos(1, 0, 0, 0, 0, 15000);
		expect(pts).toEqual([]);
	});
});
