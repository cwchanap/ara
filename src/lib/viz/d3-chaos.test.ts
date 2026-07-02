import { describe, it, expect } from 'vitest';
import { makeLinearScales, gradientColor } from './d3-chaos';
import { COLOR_PRIMARY, COLOR_SECONDARY } from '$lib/constants';

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
	it('returns the exact palette endpoints at t=0 and t=1 and interpolates between', () => {
		// d3.interpolate produces rgb() strings, so compare against the rgb
		// form of the constant palette endpoints (not the hex literals).
		const hexToRgb = (hex: string): string => {
			const n = Number.parseInt(hex.slice(1), 16);
			return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
		};
		expect(gradientColor(0)).toEqual(hexToRgb(COLOR_PRIMARY));
		expect(gradientColor(1)).toEqual(hexToRgb(COLOR_SECONDARY));
		const mid = gradientColor(0.5);
		expect(mid).not.toEqual(hexToRgb(COLOR_PRIMARY));
		expect(mid).not.toEqual(hexToRgb(COLOR_SECONDARY));
		// Midpoint must be a valid interpolated rgb() color.
		expect(mid).toMatch(/^rgb\(/);
	});
});
