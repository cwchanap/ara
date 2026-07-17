import type { GingerbreadmanColorMode } from '$lib/types';

/** The full set of user-controllable Gingerbreadman state (everything that affects the render). */
export interface GingerbreadmanPresetState {
	x0: number;
	y0: number;
	iterations: number;
	colorMode: GingerbreadmanColorMode;
	zoom: number;
	pointSize: number;
	opacity: number;
}

export interface GingerbreadmanPreset {
	id: string;
	label: string;
	state: GingerbreadmanPresetState;
}

export const GINGERBREADMAN_PRESETS: GingerbreadmanPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: {
			x0: -0.1,
			y0: 0,
			iterations: 100000,
			colorMode: 'iteration',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'near-origin',
		label: 'Near Origin',
		state: {
			x0: -0.3,
			y0: 0,
			iterations: 100000,
			colorMode: 'density',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'offset',
		label: 'Offset Seed',
		state: {
			x0: -0.75,
			y0: 0.1,
			iterations: 100000,
			colorMode: 'radius',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'far-field',
		label: 'Far Field',
		state: {
			x0: -2.13,
			y0: 0.47,
			iterations: 100000,
			colorMode: 'angle',
			zoom: 1,
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_GINGERBREADMAN_PRESET_ID = 'classic';

export function getPreset(id: string): GingerbreadmanPreset | undefined {
	return GINGERBREADMAN_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state`, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: GingerbreadmanPresetState): string | null {
	for (const preset of GINGERBREADMAN_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.x0, state.x0) &&
			numbersClose(s.y0, state.y0) &&
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
