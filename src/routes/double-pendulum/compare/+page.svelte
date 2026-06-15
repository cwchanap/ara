<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import ComparisonLayout from '$lib/components/comparison/ComparisonLayout.svelte';
	import ComparisonParameterPanel from '$lib/components/comparison/ComparisonParameterPanel.svelte';
	import DoublePendulumRenderer from '$lib/components/visualizations/DoublePendulumRenderer.svelte';
	import {
		decodeComparisonState,
		getDefaultParameters,
		encodeComparisonState
	} from '$lib/comparison-url-state';
	import { getStableRanges } from '$lib/chaos-validation';
	import type { DoublePendulumParameters } from '$lib/types';

	const initialState = decodeComparisonState($page.url, 'double-pendulum');
	const defaultParams = getDefaultParameters('double-pendulum') as DoublePendulumParameters;
	const ranges = getStableRanges('double-pendulum');

	const clampValue = (value: number, min: number, max: number, fallback: number) => {
		if (!Number.isFinite(value)) return fallback;
		return Math.min(max, Math.max(min, value));
	};

	const clampParams = (params?: DoublePendulumParameters | null): DoublePendulumParameters => {
		const source = params ?? defaultParams;
		if (!ranges) return source;
		return {
			type: 'double-pendulum',
			theta1: clampValue(source.theta1, ranges.theta1.min, ranges.theta1.max, defaultParams.theta1),
			theta2: clampValue(source.theta2, ranges.theta2.min, ranges.theta2.max, defaultParams.theta2),
			omega1: clampValue(source.omega1, ranges.omega1.min, ranges.omega1.max, defaultParams.omega1),
			omega2: clampValue(source.omega2, ranges.omega2.min, ranges.omega2.max, defaultParams.omega2),
			l1: clampValue(source.l1, ranges.l1.min, ranges.l1.max, defaultParams.l1),
			l2: clampValue(source.l2, ranges.l2.min, ranges.l2.max, defaultParams.l2),
			m1: clampValue(source.m1, ranges.m1.min, ranges.m1.max, defaultParams.m1),
			m2: clampValue(source.m2, ranges.m2.min, ranges.m2.max, defaultParams.m2),
			gravity: clampValue(
				source.gravity,
				ranges.gravity.min,
				ranges.gravity.max,
				defaultParams.gravity
			),
			damping: clampValue(
				source.damping,
				ranges.damping.min,
				ranges.damping.max,
				defaultParams.damping
			),
			speed: source.speed ?? defaultParams.speed,
			showTrail: source.showTrail ?? defaultParams.showTrail,
			trailLength: source.trailLength ?? defaultParams.trailLength,
			compareMode: false,
			compareOffset: source.compareOffset ?? defaultParams.compareOffset
		};
	};

	const leftInitial = clampParams(initialState?.left as DoublePendulumParameters | null);
	const rightInitial = clampParams(initialState?.right as DoublePendulumParameters | null);

	let leftTheta1 = $state(leftInitial.theta1);
	let leftTheta2 = $state(leftInitial.theta2);
	let leftGravity = $state(leftInitial.gravity);
	let leftL1 = $state(leftInitial.l1);
	let leftL2 = $state(leftInitial.l2);
	let leftM1 = $state(leftInitial.m1);
	let leftM2 = $state(leftInitial.m2);

	let rightTheta1 = $state(rightInitial.theta1);
	let rightTheta2 = $state(rightInitial.theta2);
	let rightGravity = $state(rightInitial.gravity);
	let rightL1 = $state(rightInitial.l1);
	let rightL2 = $state(rightInitial.l2);
	let rightM1 = $state(rightInitial.m1);
	let rightM2 = $state(rightInitial.m2);

	// Non-slider params are shared (from the left/default), so the two panels
	// differ only by the exposed parameters: initial angles, lengths, masses, gravity.
	const omega1 = leftInitial.omega1;
	const omega2 = leftInitial.omega2;
	const damping = leftInitial.damping;
	const speed = leftInitial.speed;
	const trailLength = leftInitial.trailLength;

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		void leftTheta1;
		void leftTheta2;
		void leftGravity;
		void leftL1;
		void leftL2;
		void leftM1;
		void leftM2;
		void rightTheta1;
		void rightTheta2;
		void rightGravity;
		void rightL1;
		void rightL2;
		void rightM1;
		void rightM2;
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const state = {
				compare: true as const,
				left: getLeftParams(),
				right: getRightParams()
			};
			goto(`${base}/double-pendulum/compare?${encodeComparisonState(state).toString()}`, {
				replaceState: true,
				noScroll: true
			});
		}, 300);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = null;
		};
	});

	function getLeftParams(): DoublePendulumParameters {
		return {
			type: 'double-pendulum',
			theta1: leftTheta1,
			theta2: leftTheta2,
			omega1,
			omega2,
			l1: leftL1,
			l2: leftL2,
			m1: leftM1,
			m2: leftM2,
			gravity: leftGravity,
			damping,
			speed,
			showTrail: true,
			trailLength,
			compareMode: false,
			compareOffset: leftInitial.compareOffset
		};
	}
	function getRightParams(): DoublePendulumParameters {
		return {
			type: 'double-pendulum',
			theta1: rightTheta1,
			theta2: rightTheta2,
			omega1,
			omega2,
			l1: rightL1,
			l2: rightL2,
			m1: rightM1,
			m2: rightM2,
			gravity: rightGravity,
			damping,
			speed,
			showTrail: true,
			trailLength,
			compareMode: false,
			compareOffset: rightInitial.compareOffset
		};
	}

	function handleLeftParamsChange(p: DoublePendulumParameters) {
		leftTheta1 = p.theta1;
		leftTheta2 = p.theta2;
		leftGravity = p.gravity;
		leftL1 = p.l1;
		leftL2 = p.l2;
		leftM1 = p.m1;
		leftM2 = p.m2;
	}
	function handleRightParamsChange(p: DoublePendulumParameters) {
		rightTheta1 = p.theta1;
		rightTheta2 = p.theta2;
		rightGravity = p.gravity;
		rightL1 = p.l1;
		rightL2 = p.l2;
		rightM1 = p.m1;
		rightM2 = p.m2;
	}
</script>

<ComparisonLayout
	mapType="double-pendulum"
	leftParams={getLeftParams()}
	rightParams={getRightParams()}
	showCameraSync={false}
	onLeftParamsChange={(p) => handleLeftParamsChange(p as DoublePendulumParameters)}
	onRightParamsChange={(p) => handleRightParamsChange(p as DoublePendulumParameters)}
>
	{#snippet leftPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="LEFT_PARAMETERS">
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-theta1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">θ₁</label
								>
								<span class="font-mono text-accent text-sm">{leftTheta1.toFixed(2)}</span>
							</div>
							<input
								id="left-theta1"
								type="range"
								bind:value={leftTheta1}
								min="-3.14159"
								max="3.14159"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-theta2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">θ₂</label
								>
								<span class="font-mono text-accent text-sm">{leftTheta2.toFixed(2)}</span>
							</div>
							<input
								id="left-theta2"
								type="range"
								bind:value={leftTheta2}
								min="-3.14159"
								max="3.14159"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="left-gravity"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Gravity</label
							>
							<span class="font-mono text-accent text-sm">{leftGravity.toFixed(1)}</span>
						</div>
						<input
							id="left-gravity"
							type="range"
							bind:value={leftGravity}
							min="0"
							max="50"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-l1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">L₁</label
								>
								<span class="font-mono text-accent text-sm">{leftL1.toFixed(2)}</span>
							</div>
							<input
								id="left-l1"
								type="range"
								bind:value={leftL1}
								min="0.1"
								max="5"
								step="0.05"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-l2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">L₂</label
								>
								<span class="font-mono text-accent text-sm">{leftL2.toFixed(2)}</span>
							</div>
							<input
								id="left-l2"
								type="range"
								bind:value={leftL2}
								min="0.1"
								max="5"
								step="0.05"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-m1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">m₁</label
								>
								<span class="font-mono text-accent text-sm">{leftM1.toFixed(1)}</span>
							</div>
							<input
								id="left-m1"
								type="range"
								bind:value={leftM1}
								min="0.1"
								max="10"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="left-m2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">m₂</label
								>
								<span class="font-mono text-accent text-sm">{leftM2.toFixed(1)}</span>
							</div>
							<input
								id="left-m2"
								type="range"
								bind:value={leftM2}
								min="0.1"
								max="10"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
				</div>
				{#snippet equations()}<p>θ̈₁ = f₁(θ₁, θ₂, ω₁, ω₂)</p>
					<p>θ̈₂ = f₂(θ₁, θ₂, ω₁, ω₂)</p>{/snippet}
			</ComparisonParameterPanel>
			<DoublePendulumRenderer
				theta1={leftTheta1}
				theta2={leftTheta2}
				{omega1}
				{omega2}
				l1={leftL1}
				l2={leftL2}
				m1={leftM1}
				m2={leftM2}
				gravity={leftGravity}
				{damping}
				{speed}
				showTrail={true}
				{trailLength}
				compareMode={false}
				height={400}
			/>
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<div class="space-y-4">
			<ComparisonParameterPanel title="RIGHT_PARAMETERS">
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-theta1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">θ₁</label
								>
								<span class="font-mono text-accent text-sm">{rightTheta1.toFixed(2)}</span>
							</div>
							<input
								id="right-theta1"
								type="range"
								bind:value={rightTheta1}
								min="-3.14159"
								max="3.14159"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-theta2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">θ₂</label
								>
								<span class="font-mono text-accent text-sm">{rightTheta2.toFixed(2)}</span>
							</div>
							<input
								id="right-theta2"
								type="range"
								bind:value={rightTheta2}
								min="-3.14159"
								max="3.14159"
								step="0.01"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="space-y-1">
						<div class="flex justify-between items-end">
							<label
								for="right-gravity"
								class="text-primary/80 text-xs uppercase tracking-widest font-bold">Gravity</label
							>
							<span class="font-mono text-accent text-sm">{rightGravity.toFixed(1)}</span>
						</div>
						<input
							id="right-gravity"
							type="range"
							bind:value={rightGravity}
							min="0"
							max="50"
							step="0.1"
							class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
						/>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-l1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">L₁</label
								>
								<span class="font-mono text-accent text-sm">{rightL1.toFixed(2)}</span>
							</div>
							<input
								id="right-l1"
								type="range"
								bind:value={rightL1}
								min="0.1"
								max="5"
								step="0.05"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-l2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">L₂</label
								>
								<span class="font-mono text-accent text-sm">{rightL2.toFixed(2)}</span>
							</div>
							<input
								id="right-l2"
								type="range"
								bind:value={rightL2}
								min="0.1"
								max="5"
								step="0.05"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-m1"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">m₁</label
								>
								<span class="font-mono text-accent text-sm">{rightM1.toFixed(1)}</span>
							</div>
							<input
								id="right-m1"
								type="range"
								bind:value={rightM1}
								min="0.1"
								max="10"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
						<div class="space-y-1">
							<div class="flex justify-between items-end">
								<label
									for="right-m2"
									class="text-primary/80 text-xs uppercase tracking-widest font-bold">m₂</label
								>
								<span class="font-mono text-accent text-sm">{rightM2.toFixed(1)}</span>
							</div>
							<input
								id="right-m2"
								type="range"
								bind:value={rightM2}
								min="0.1"
								max="10"
								step="0.1"
								class="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
							/>
						</div>
					</div>
				</div>
				{#snippet equations()}<p>θ̈₁ = f₁(θ₁, θ₂, ω₁, ω₂)</p>
					<p>θ̈₂ = f₂(θ₁, θ₂, ω₁, ω₂)</p>{/snippet}
			</ComparisonParameterPanel>
			<DoublePendulumRenderer
				theta1={rightTheta1}
				theta2={rightTheta2}
				{omega1}
				{omega2}
				l1={rightL1}
				l2={rightL2}
				m1={rightM1}
				m2={rightM2}
				gravity={rightGravity}
				{damping}
				{speed}
				showTrail={true}
				{trailLength}
				compareMode={false}
				height={400}
			/>
		</div>
	{/snippet}
</ComparisonLayout>
