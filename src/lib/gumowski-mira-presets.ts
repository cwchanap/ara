import type { GumowskiMiraColorMode, GumowskiMiraRenderMode } from '$lib/types';

/** The full set of user-controllable Gumowski–Mira state (everything that affects the render). */
export interface GumowskiMiraPresetState {
	mu: number;
	a: number;
	b: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
	renderMode: GumowskiMiraRenderMode;
	seeds: number;
	colorMode: GumowskiMiraColorMode;
	pointSize: number;
	opacity: number;
}

export interface GumowskiMiraPreset {
	id: string;
	label: string;
	state: GumowskiMiraPresetState;
}

export const GUMOWSKI_MIRA_PRESETS: GumowskiMiraPreset[] = [
	{
		id: 'ordered-curves',
		label: 'Ordered Curves',
		state: {
			mu: -0.4,
			a: 0.008,
			b: 0.5,
			x0: 0.1,
			y0: 0,
			iterations: 12000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'island-structure',
		label: 'Island Structure',
		state: {
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'transitional',
		label: 'Transitional',
		state: {
			mu: 0.4,
			a: 0.02,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'seed',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'dense-chaos',
		label: 'Dense Chaos',
		state: {
			mu: 0.55,
			a: 0.05,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 18000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 500,
			colorMode: 'radius',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'spiral-sweep',
		label: 'Spiral Sweep',
		state: {
			mu: -0.827,
			a: 0.008,
			b: 0.05,
			x0: 0.1,
			y0: 0,
			iterations: 15000,
			burnIn: 500,
			renderMode: 'multi',
			seeds: 300,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_GUMOWSKI_MIRA_PRESET_ID = 'island-structure';

export function getPreset(id: string): GumowskiMiraPreset | undefined {
	return GUMOWSKI_MIRA_PRESETS.find((p) => p.id === id);
}

function numbersClose(x: number, y: number): boolean {
	return Math.abs(x - y) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state` exactly, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: GumowskiMiraPresetState): string | null {
	for (const preset of GUMOWSKI_MIRA_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.mu, state.mu) &&
			numbersClose(s.a, state.a) &&
			numbersClose(s.b, state.b) &&
			numbersClose(s.x0, state.x0) &&
			numbersClose(s.y0, state.y0) &&
			s.iterations === state.iterations &&
			s.burnIn === state.burnIn &&
			s.renderMode === state.renderMode &&
			s.seeds === state.seeds &&
			s.colorMode === state.colorMode &&
			numbersClose(s.pointSize, state.pointSize) &&
			numbersClose(s.opacity, state.opacity)
		) {
			return preset.id;
		}
	}
	return null;
}
