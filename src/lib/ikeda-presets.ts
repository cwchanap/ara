import type { IkedaColorMode, IkedaRenderMode } from '$lib/types';

/** The full set of user-controllable Ikeda state (everything that affects the render). */
export interface IkedaPresetState {
	u: number;
	x0: number;
	y0: number;
	iterations: number;
	burnIn: number;
	renderMode: IkedaRenderMode;
	seeds: number;
	colorMode: IkedaColorMode;
	pointSize: number;
	opacity: number;
}

export interface IkedaPreset {
	id: string;
	label: string;
	state: IkedaPresetState;
}

export const IKEDA_PRESETS: IkedaPreset[] = [
	{
		id: 'low-feedback',
		label: 'Low Feedback',
		state: {
			u: 0.6,
			x0: 0.1,
			y0: 0,
			iterations: 600,
			burnIn: 100,
			renderMode: 'multi',
			seeds: 200,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'transition',
		label: 'Transition',
		state: {
			u: 0.85,
			x0: 0.1,
			y0: 0,
			iterations: 700,
			burnIn: 100,
			renderMode: 'multi',
			seeds: 220,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'structured-chaos',
		label: 'Structured Chaos',
		state: {
			u: 0.9,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			renderMode: 'multi',
			seeds: 250,
			colorMode: 'seed',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'classic-ikeda',
		label: 'Classic Ikeda',
		state: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 800,
			burnIn: 100,
			renderMode: 'multi',
			seeds: 250,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6
		}
	},
	{
		id: 'dense-fractal',
		label: 'Dense Fractal',
		state: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 1200,
			burnIn: 150,
			renderMode: 'multi',
			seeds: 600,
			colorMode: 'radius',
			pointSize: 1,
			opacity: 0.5
		}
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_IKEDA_PRESET_ID = 'classic-ikeda';

export function getPreset(id: string): IkedaPreset | undefined {
	return IKEDA_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/**
 * Return the id of the preset whose state matches `state` exactly, or null
 * (meaning the user is in a "Custom" state).
 */
export function detectPresetId(state: IkedaPresetState): string | null {
	for (const preset of IKEDA_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.u, state.u) &&
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
