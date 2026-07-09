import type { TinkerbellColorMode } from '$lib/types';

/** The full set of user-controllable Tinkerbell state (everything that affects the render). */
export interface TinkerbellPresetState {
	a: number;
	b: number;
	c: number;
	d: number;
	iterations: number;
	colorMode: TinkerbellColorMode;
	zoom: number;
	pointSize: number;
	opacity: number;
}

export interface TinkerbellPreset {
	id: string;
	label: string;
	state: TinkerbellPresetState;
}

export const TINKERBELL_PRESETS: TinkerbellPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: {
			a: 0.9,
			b: -0.6013,
			c: 2.0,
			d: 0.5,
			iterations: 100000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'symmetric',
		label: 'Symmetric Pair',
		state: {
			a: 0.8,
			b: -0.6,
			c: 1.7,
			d: 0.5,
			iterations: 100000,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.2,
			opacity: 0.55
		}
	},
	{
		id: 'delicate',
		label: 'Delicate',
		state: {
			a: -0.71,
			b: -0.4,
			c: 1.1,
			d: 0.4,
			iterations: 100000,
			colorMode: 'angle',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'dense-spiral',
		label: 'Dense Spiral',
		state: {
			a: 0.97,
			b: -0.799,
			c: 1.85,
			d: 0.55,
			iterations: 120000,
			colorMode: 'radius',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_TINKERBELL_PRESET_ID = 'classic';

export function getPreset(id: string): TinkerbellPreset | undefined {
	return TINKERBELL_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state`, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: TinkerbellPresetState): string | null {
	for (const preset of TINKERBELL_PRESETS) {
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
