import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./gingerbreadman-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./gingerbreadman-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters gingerbreadman preset fallback', () => {
	test('throws when gingerbreadman default preset is missing', () => {
		expect(() => getDefaultParameters('gingerbreadman')).toThrow(
			'Missing default Gingerbreadman preset'
		);
	});
});
