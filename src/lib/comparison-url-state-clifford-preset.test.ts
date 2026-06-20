import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./clifford-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./clifford-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters clifford preset fallback', () => {
	test('throws when clifford default preset is missing', () => {
		expect(() => getDefaultParameters('clifford')).toThrow('Missing default Clifford preset');
	});
});
