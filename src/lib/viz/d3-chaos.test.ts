import { describe, it, expect } from 'vitest';
import { makeLinearScales, gradientColor } from './d3-chaos';

describe('makeLinearScales', () => {
	it('pads extents by 0.1 and maps to ranges', () => {
		const pts: [number, number][] = [
			[0, 0],
			[2, 4]
		];
		const { xScale, yScale, xExtent, yExtent } = makeLinearScales(pts, {
			width: 100,
			height: 50
		});
		expect(xExtent).toEqual([0, 2]);
		expect(yExtent).toEqual([0, 4]);
		expect(xScale.domain()).toEqual([-0.1, 2.1]);
		expect(yScale.domain()).toEqual([-0.1, 4.1]);
		expect(xScale.range()).toEqual([0, 100]);
		expect(yScale.range()).toEqual([50, 0]); // inverted
	});

	it('falls back to [-1,1] for empty input', () => {
		const { xExtent } = makeLinearScales([], { width: 10, height: 10 });
		expect(xExtent).toEqual([-1, 1]);
	});
});

describe('gradientColor', () => {
	it('returns endpoints at t=0 and t=1', () => {
		expect(gradientColor(0)).toBeTruthy();
		expect(gradientColor(1)).toBeTruthy();
		expect(gradientColor(0)).not.toEqual(gradientColor(1));
	});
});
