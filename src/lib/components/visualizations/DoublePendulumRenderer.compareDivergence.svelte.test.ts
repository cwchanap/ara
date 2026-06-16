/**
 * Isolated coverage for DoublePendulumRenderer's compareMode divergence guard.
 *
 * The renderer halts when `!isFiniteState(stateA) || (compareMode && !isFiniteState(stateB))`.
 * Under real deterministic physics, stateB (stateA seeded with a tiny offset) diverges in the
 * SAME step as stateA, so the stateA check short-circuits first and the `stateB` sub-condition
 * is never the *trigger*. This file mocks the physics module so stateB blows up while stateA
 * stays finite, proving that specific guard branch halts the loop and surfaces the overlay.
 *
 * Lives in its own file because vi.mock is module-scoped and would perturb the
 * real-physics tests in DoublePendulumRenderer.svelte.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';

const BASE_THETA1 = Math.PI / 2;
const OFFSET = 0.1; // large enough to distinguish stateB from stateA

vi.mock('$lib/double-pendulum', () => ({
	// Real finite-state check: all four components must be finite.
	isFiniteState: (s: { theta1: number; theta2: number; omega1: number; omega2: number }) =>
		Number.isFinite(s.theta1) &&
		Number.isFinite(s.theta2) &&
		Number.isFinite(s.omega1) &&
		Number.isFinite(s.omega2),
	// No-op wrap; we only pump a single step so drift is irrelevant.
	wrapAngle: (a: number) => a,
	bobPositions: () => ({ x1: 0, y1: 1, x2: 1, y2: 2 }),
	divergence: () => 0,
	// The crux: stateB (seeded at theta1 + OFFSET) goes non-finite; stateA stays finite.
	rk4Step: (state: { theta1: number; theta2: number; omega1: number; omega2: number }) => {
		const isStateB = Math.abs(state.theta1 - (BASE_THETA1 + OFFSET)) < 1e-6;
		return isStateB ? { ...state, omega1: NaN, omega2: NaN } : state;
	}
}));

import DoublePendulumRenderer from './DoublePendulumRenderer.svelte';

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
	originalGetContext = HTMLCanvasElement.prototype.getContext;
	const ctx = {
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		setTransform: vi.fn(),
		strokeStyle: '',
		lineWidth: 1,
		globalAlpha: 1,
		fillStyle: ''
	};
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () => ctx
	});
});

afterAll(() => {
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: originalGetContext
	});
});

beforeEach(() => {
	// Default no-op rAF; the test below overrides it with a manual pump before render.
	let id = 0;
	vi.stubGlobal(
		'requestAnimationFrame',
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		(_cb: FrameRequestCallback) => {
			id += 1;
			return id;
		}
	);
	vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('DoublePendulumRenderer – compareMode stateB divergence guard', () => {
	it('halts via the stateB (!isFiniteState) branch when stateA stays finite', async () => {
		const queue: Array<{ id: number; cb: FrameRequestCallback }> = [];
		let nextId = 0;
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			nextId += 1;
			queue.push({ id: nextId, cb });
			return nextId;
		});
		vi.stubGlobal('cancelAnimationFrame', (id: number) => {
			const idx = queue.findIndex((q) => q.id === id);
			if (idx !== -1) queue.splice(idx, 1);
		});

		const { container } = render(DoublePendulumRenderer, {
			props: {
				theta1: BASE_THETA1,
				theta2: Math.PI / 2,
				omega1: 0,
				omega2: 0,
				l1: 1,
				l2: 1,
				m1: 1,
				m2: 1,
				gravity: 9.81,
				damping: 0,
				compareMode: true,
				compareOffset: OFFSET,
				height: 400
			}
		});

		expect(queue.length).toBeGreaterThan(0);
		// First pump initializes `last`; second pump runs the physics step where
		// the mocked rk4Step makes stateB non-finite while stateA stays finite.
		queue.splice(0).forEach((q) => q.cb(16.67));
		queue.splice(0).forEach((q) => q.cb(33.33));
		await tick();

		expect(container.textContent).toContain('SIMULATION DIVERGED');
	});
});
