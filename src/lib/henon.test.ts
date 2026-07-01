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
