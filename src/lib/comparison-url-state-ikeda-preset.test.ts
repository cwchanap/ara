import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./ikeda-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./ikeda-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters ikeda preset fallback', () => {
	test('throws when ikeda default preset is missing', () => {
		expect(() => getDefaultParameters('ikeda')).toThrow('Missing default Ikeda preset');
	});
});
