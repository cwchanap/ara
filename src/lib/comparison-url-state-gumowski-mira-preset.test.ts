import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./gumowski-mira-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./gumowski-mira-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters gumowski-mira preset fallback', () => {
	test('throws when gumowski-mira default preset is missing', () => {
		expect(() => getDefaultParameters('gumowski-mira')).toThrow(
			'Missing default Gumowski-Mira preset'
		);
	});
});
