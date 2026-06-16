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

export const DOUBLE_PENDULUM_PRESETS: readonly DoublePendulumPreset[] = [
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

/**
 * Per-field comparison kind for EVERY field of DoublePendulumState. The
 * `satisfies Record<keyof DoublePendulumState, ...>` guard makes this
 * compile-complete: adding a field to DoublePendulumState without listing it
 * here is a type error, so detectPresetId can never silently ignore a new
 * field (which would cause a preset to mis-detect as "Custom").
 */
const FIELD_KIND = {
	theta1: 'number',
	theta2: 'number',
	omega1: 'number',
	omega2: 'number',
	l1: 'number',
	l2: 'number',
	m1: 'number',
	m2: 'number',
	gravity: 'number',
	damping: 'number',
	speed: 'number',
	showTrail: 'boolean',
	trailLength: 'number',
	compareMode: 'boolean',
	compareOffset: 'number'
} satisfies Record<keyof DoublePendulumState, 'number' | 'boolean'>;

const STATE_FIELDS = Object.keys(FIELD_KIND) as Array<keyof DoublePendulumState>;

/** Id of the preset whose state matches exactly, or null ("Custom"). */
export function detectPresetId(state: DoublePendulumState): string | null {
	for (const preset of DOUBLE_PENDULUM_PRESETS) {
		const s = preset.state;
		const allMatch = STATE_FIELDS.every((key) => {
			const a = s[key];
			const b = state[key];
			if (FIELD_KIND[key] === 'number') {
				return (
					typeof a === 'number' &&
					typeof b === 'number' &&
					numbersClose(a as number, b as number)
				);
			}
			return a === b;
		});
		if (allMatch) return preset.id;
	}
	return null;
}
