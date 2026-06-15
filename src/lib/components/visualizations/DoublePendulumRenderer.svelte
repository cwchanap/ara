<!--
  DoublePendulumRenderer Component

  Canvas-2D real-time double pendulum. Owns the requestAnimationFrame loop,
  the evolving physics state, a capped fading trail, and an optional in-canvas
  comparison overlay (a second pendulum seeded with a tiny angle offset) plus a
  live divergence readout.

  Parameter philosophy:
  - Initial conditions (theta/omega) + restartSignal + compareMode/compareOffset
    re-seed the live simulation and clear trails.
  - Physical parameters (l, m, gravity, damping) apply live without re-seeding.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		rk4Step,
		bobPositions,
		divergence,
		isFiniteState,
		wrapAngle,
		type PendulumState,
		type PendulumPhysics
	} from '$lib/double-pendulum';

	interface Props {
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
		speed?: number;
		showTrail?: boolean;
		trailLength?: number;
		compareMode?: boolean;
		compareOffset?: number;
		/** Increment to force a restart (Reset/Randomize) even if initial conditions are unchanged. */
		restartSignal?: number;
		running?: boolean;
		height?: number;
		/** Live distance between the two second-bobs (output). 0 when comparison is off. */
		divergenceValue?: number;
		/** Set true when the simulation blows up to NaN/Infinity (output). */
		diverged?: boolean;
		/** Container element exposed for SnapshotButton. */
		containerElement?: HTMLDivElement;
	}

	let {
		theta1,
		theta2,
		omega1,
		omega2,
		l1,
		l2,
		m1,
		m2,
		gravity,
		damping,
		speed = 1,
		showTrail = true,
		trailLength = 400,
		compareMode = false,
		compareOffset = 0.001,
		restartSignal = 0,
		running = $bindable(true),
		height = 600,
		divergenceValue = $bindable(0),
		diverged = $bindable(false),
		containerElement = $bindable()
	}: Props = $props();

	const FIXED_DT = 0.005; // physics timestep (s)
	const MAX_FRAME_DT = 0.05; // clamp elapsed time after tab inactivity (s)
	const MAX_STEPS_PER_FRAME = 240; // avoid the "spiral of death"

	let container = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();

	let stateA: PendulumState = { theta1, theta2, omega1, omega2 };
	let stateB: PendulumState = { theta1: theta1 + compareOffset, theta2, omega1, omega2 };
	let trailA: Array<{ x: number; y: number }> = [];
	let trailB: Array<{ x: number; y: number }> = [];

	let physics: PendulumPhysics = { l1, l2, m1, m2, gravity, damping };

	$effect(() => {
		containerElement = container;
	});

	// Live physical parameters — apply without re-seeding.
	$effect(() => {
		physics = { l1, l2, m1, m2, gravity, damping };
	});

	// Re-seed when initial conditions, compare settings, or restartSignal change.
	$effect(() => {
		void theta1;
		void theta2;
		void omega1;
		void omega2;
		void compareMode;
		void compareOffset;
		void restartSignal;
		stateA = { theta1, theta2, omega1, omega2 };
		stateB = { theta1: theta1 + compareOffset, theta2, omega1, omega2 };
		trailA = [];
		trailB = [];
		divergenceValue = 0;
		diverged = false;
	});

	function pushTrail(trail: Array<{ x: number; y: number }>, x: number, y: number) {
		trail.push({ x, y });
		if (trail.length > trailLength) trail.splice(0, trail.length - trailLength);
	}

	function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
		ctx.clearRect(0, 0, w, h);

		const totalLen = physics.l1 + physics.l2 || 1;
		const scale = (Math.min(w, h) * 0.42) / totalLen;
		const pivotX = w / 2;
		const pivotY = h * 0.32;

		const toPx = (x: number, y: number) => ({ px: pivotX + x * scale, py: pivotY + y * scale });

		const drawTrail = (trail: Array<{ x: number; y: number }>, rgb: string) => {
			if (!showTrail || trail.length < 2) return;
			for (let i = 1; i < trail.length; i++) {
				const a = toPx(trail[i - 1].x, trail[i - 1].y);
				const b = toPx(trail[i].x, trail[i].y);
				ctx.strokeStyle = `rgba(${rgb}, ${(i / trail.length) * 0.7})`;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.moveTo(a.px, a.py);
				ctx.lineTo(b.px, b.py);
				ctx.stroke();
			}
		};

		const drawArms = (s: PendulumState, color: string, dim: boolean) => {
			const pos = bobPositions(s, physics);
			const p1 = toPx(pos.x1, pos.y1);
			const p2 = toPx(pos.x2, pos.y2);
			ctx.strokeStyle = color;
			ctx.globalAlpha = dim ? 0.7 : 1;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(pivotX, pivotY);
			ctx.lineTo(p1.px, p1.py);
			ctx.lineTo(p2.px, p2.py);
			ctx.stroke();
			ctx.fillStyle = color;
			const r1 = 4 + 2 * Math.sqrt(physics.m1);
			const r2 = 4 + 2 * Math.sqrt(physics.m2);
			ctx.beginPath();
			ctx.arc(p1.px, p1.py, r1, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(p2.px, p2.py, r2, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		};

		// pivot
		ctx.fillStyle = '#00f3ff';
		ctx.beginPath();
		ctx.arc(pivotX, pivotY, 3, 0, Math.PI * 2);
		ctx.fill();

		drawTrail(trailA, '0, 243, 255');
		if (compareMode) drawTrail(trailB, '255, 0, 255');
		if (compareMode) drawArms(stateB, '#ff00ff', true);
		drawArms(stateA, '#00f3ff', false);
	}

	onMount(() => {
		if (!canvas || !container) return;
		const cv = canvas;
		const ctx = cv.getContext('2d');
		if (!ctx) return;

		let raf = 0;
		let last = 0;
		let acc = 0;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			const w = container!.clientWidth;
			const h = container!.clientHeight;
			cv.width = Math.max(1, Math.floor(w * dpr));
			cv.height = Math.max(1, Math.floor(h * dpr));
			cv.style.width = w + 'px';
			cv.style.height = h + 'px';
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		const ro = new ResizeObserver(resize);
		ro.observe(container);

		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			if (last === 0) last = now;
			let frameDt = (now - last) / 1000;
			last = now;
			if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;

			if (running && !diverged) {
				acc += Math.min(frameDt, MAX_FRAME_DT) * speed;
				let steps = 0;
				while (acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
					stateA = rk4Step(stateA, physics, FIXED_DT);
					if (compareMode) stateB = rk4Step(stateB, physics, FIXED_DT);
					// Keep angles in [-PI, PI] to avoid floating-point precision
					// loss over very long runs. Safe because derivatives only use
					// sin/cos of the angles (2π-periodic).
					stateA = {
						theta1: wrapAngle(stateA.theta1),
						theta2: wrapAngle(stateA.theta2),
						omega1: stateA.omega1,
						omega2: stateA.omega2
					};
					if (compareMode) {
						stateB = {
							theta1: wrapAngle(stateB.theta1),
							theta2: wrapAngle(stateB.theta2),
							omega1: stateB.omega1,
							omega2: stateB.omega2
						};
					}
					acc -= FIXED_DT;
					steps += 1;
					if (!isFiniteState(stateA) || (compareMode && !isFiniteState(stateB))) {
						diverged = true;
						running = false;
						acc = 0;
						break;
					}
				}
				if (acc > FIXED_DT * MAX_STEPS_PER_FRAME) acc = 0;

				const pa = bobPositions(stateA, physics);
				pushTrail(trailA, pa.x2, pa.y2);
				if (compareMode) {
					const pb = bobPositions(stateB, physics);
					pushTrail(trailB, pb.x2, pb.y2);
					divergenceValue = divergence(stateA, stateB, physics);
				}
			}

			const dpr = window.devicePixelRatio || 1;
			draw(ctx, cv.width / dpr, cv.height / dpr);
		};
		raf = requestAnimationFrame(frame);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
		};
	});
</script>

<div
	bind:this={container}
	class="bg-black/40 border border-primary/20 rounded-sm overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] relative backdrop-blur-md"
	style="height: {height}px;"
>
	<canvas bind:this={canvas} class="block"></canvas>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>
	<div
		class="absolute top-4 right-4 text-xs font-['Orbitron'] text-primary/40 border border-primary/20 px-2 py-1 pointer-events-none select-none"
	>
		DOUBLE_PENDULUM_RENDERER
	</div>
	{#if compareMode}
		<div
			data-testid="divergence-readout"
			class="absolute top-4 left-4 text-xs font-mono text-fuchsia-300 border border-fuchsia-500/30 bg-black/50 px-2 py-1 pointer-events-none select-none"
		>
			DIVERGENCE: {divergenceValue.toFixed(3)}
		</div>
	{/if}
	{#if diverged}
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div class="bg-black/80 border border-fuchsia-500/60 rounded-sm px-6 py-3 text-center">
				<p class="text-fuchsia-400 font-['Orbitron'] text-sm tracking-widest uppercase">
					⚠ SIMULATION DIVERGED
				</p>
				<p class="text-fuchsia-300/70 text-xs mt-1">Reset or reduce parameter extremes</p>
			</div>
		</div>
	{/if}
</div>
