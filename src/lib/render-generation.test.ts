import { describe, expect, it } from 'vitest';
import { RenderGeneration } from './render-generation';

describe('RenderGeneration', () => {
	it('starts at 0 and increments', () => {
		const gen = new RenderGeneration();
		expect(gen.next()).toBe(1);
		expect(gen.next()).toBe(2);
	});

	it('reports stale for old IDs', () => {
		const gen = new RenderGeneration();
		const id1 = gen.next();
		gen.next();
		expect(gen.isStale(id1)).toBe(true);
	});

	it('reports not-stale for current ID', () => {
		const gen = new RenderGeneration();
		const id = gen.next();
		expect(gen.isStale(id)).toBe(false);
	});

	it('rapid invalidation: all previous IDs are stale', () => {
		const gen = new RenderGeneration();
		const ids = [gen.next(), gen.next(), gen.next(), gen.next(), gen.next()];
		for (const id of ids.slice(0, -1)) {
			expect(gen.isStale(id)).toBe(true);
		}
		expect(gen.isStale(5)).toBe(false);
	});
});
