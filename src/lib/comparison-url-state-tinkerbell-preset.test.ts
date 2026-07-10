import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./tinkerbell-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./tinkerbell-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters tinkerbell preset fallback', () => {
	test('throws when tinkerbell default preset is missing', () => {
		expect(() => getDefaultParameters('tinkerbell')).toThrow(
			'Missing default Tinkerbell preset'
		);
	});
});
