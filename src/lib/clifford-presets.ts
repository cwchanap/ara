import type { CliffordColorMode } from '$lib/types';

/** The full set of user-controllable Clifford state (everything that affects the render). */
export interface CliffordPresetState {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	colorMode: CliffordColorMode;
	zoom: number;
	pointSize: number;
	opacity: number;
}

export interface CliffordPreset {
	id: string;
	label: string;
	state: CliffordPresetState;
}

export const CLIFFORD_PRESETS: CliffordPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: {
			a: -1.4,
			b: 1.6,
			c: 1.0,
			d: 0.7,
			iterations: 120000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'wings',
		label: 'Wings',
		state: {
			a: 1.7,
			b: 1.7,
			c: 0.6,
			d: 1.2,
			iterations: 120000,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.2,
			opacity: 0.55
		}
	},
	{
		id: 'web',
		label: 'Web',
		state: {
			a: -1.7,
			b: 1.3,
			c: -0.1,
			d: -1.21,
			iterations: 150000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'swirl',
		label: 'Swirl',
		state: {
			a: 1.5,
			b: -1.8,
			c: 1.6,
			d: 0.9,
			iterations: 120000,
			colorMode: 'angle',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'ribbons',
		label: 'Ribbons',
		state: {
			a: -1.8,
			b: -2.0,
			c: -0.5,
			d: -0.9,
			iterations: 120000,
			colorMode: 'radius',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_CLIFFORD_PRESET_ID = 'classic';

export function getPreset(id: string): CliffordPreset | undefined {
	return CLIFFORD_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state` exactly, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: CliffordPresetState): string | null {
	for (const preset of CLIFFORD_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.a, state.a) &&
			numbersClose(s.b, state.b) &&
			numbersClose(s.c, state.c) &&
			numbersClose(s.d, state.d) &&
			s.iterations === state.iterations &&
			s.colorMode === state.colorMode &&
			numbersClose(s.zoom, state.zoom) &&
			numbersClose(s.pointSize, state.pointSize) &&
			numbersClose(s.opacity, state.opacity)
		) {
			return preset.id;
		}
	}
	return null;
}
