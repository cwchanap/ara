import { describe, expect, test, vi } from 'vitest';
import { getDefaultParameters } from './comparison-url-state';

vi.mock('./double-pendulum-presets', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./double-pendulum-presets')>();
	return {
		...actual,
		getPreset: vi.fn(() => undefined)
	};
});

describe('getDefaultParameters double-pendulum preset fallback', () => {
	test('throws when double-pendulum default preset is missing', () => {
		expect(() => getDefaultParameters('double-pendulum')).toThrow(
			'Missing default double-pendulum preset'
		);
	});
});
