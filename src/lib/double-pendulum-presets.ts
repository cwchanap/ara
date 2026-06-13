/** Full set of user-controllable double pendulum state (everything that is persisted). */
export interface DoublePendulumState {
	theta1: number;
	theta2: number;
	omega1: number;
	omega2: number;
	l1: number;
	l2: number;
	m1: number;
	m2: number;
	gravity: number;
	damping: number;
	speed: number;
	showTrail: boolean;
	trailLength: number;
	compareMode: boolean;
	compareOffset: number;
}

export interface DoublePendulumPreset {
	id: string;
	label: string;
	state: DoublePendulumState;
}

const BASE: Omit<DoublePendulumState, 'theta1' | 'theta2' | 'm1' | 'm2' | 'damping'> = {
	omega1: 0,
	omega2: 0,
	l1: 1,
	l2: 1,
	gravity: 9.81,
	speed: 1,
	showTrail: true,
	trailLength: 400,
	compareMode: false,
	compareOffset: 0.001
};

export const DOUBLE_PENDULUM_PRESETS: DoublePendulumPreset[] = [
	{
		id: 'classic',
		label: 'Classic',
		state: { ...BASE, theta1: Math.PI / 2, theta2: Math.PI / 2, m1: 1, m2: 1, damping: 0 }
	},
	{
		id: 'near-vertical',
		label: 'Near Vertical',
		state: { ...BASE, theta1: Math.PI * 0.99, theta2: Math.PI * 0.99, m1: 1, m2: 1, damping: 0 }
	},
	{
		id: 'asymmetric',
		label: 'Asymmetric',
		state: { ...BASE, theta1: Math.PI / 2, theta2: Math.PI, m1: 2, m2: 1, damping: 0 }
	},
	{
		id: 'damped',
		label: 'Damped',
		state: { ...BASE, theta1: Math.PI / 2, theta2: Math.PI / 2, m1: 1, m2: 1, damping: 0.1 }
	}
];

/** The preset that defines the default page state. */
export const DEFAULT_DOUBLE_PENDULUM_PRESET_ID = 'classic';

export function getPreset(id: string): DoublePendulumPreset | undefined {
	return DOUBLE_PENDULUM_PRESETS.find((p) => p.id === id);
}

function numbersClose(a: number, b: number): boolean {
	return Math.abs(a - b) < 1e-9;
}

/** Id of the preset whose state matches exactly, or null ("Custom"). */
export function detectPresetId(state: DoublePendulumState): string | null {
	for (const preset of DOUBLE_PENDULUM_PRESETS) {
		const s = preset.state;
		if (
			numbersClose(s.theta1, state.theta1) &&
			numbersClose(s.theta2, state.theta2) &&
			numbersClose(s.omega1, state.omega1) &&
			numbersClose(s.omega2, state.omega2) &&
			numbersClose(s.l1, state.l1) &&
			numbersClose(s.l2, state.l2) &&
			numbersClose(s.m1, state.m1) &&
			numbersClose(s.m2, state.m2) &&
			numbersClose(s.gravity, state.gravity) &&
			numbersClose(s.damping, state.damping) &&
			numbersClose(s.speed, state.speed) &&
			s.showTrail === state.showTrail &&
			s.trailLength === state.trailLength &&
			s.compareMode === state.compareMode &&
			numbersClose(s.compareOffset, state.compareOffset)
		) {
			return preset.id;
		}
	}
	return null;
}
