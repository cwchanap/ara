<!--
  Test stub for renderers that need two-way bindable props.
  Declares all commonly-bound props as $bindable() so parent pages under
  test can two-way bind to them. Exposes a button that, when clicked,
  writes to every numeric bindable prop — triggering the parent's setter
  and covering the bind: directive lines.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		label?: string;
		// Numeric params
		a?: number;
		b?: number;
		c?: number;
		d?: number;
		u?: number;
		r?: number;
		k?: number;
		alpha?: number;
		beta?: number;
		gamma?: number;
		x0?: number;
		y0?: number;
		iterations?: number;
		burnIn?: number;
		numP?: number;
		numQ?: number;
		maxIterations?: number;
		rMin?: number;
		rMax?: number;
		aMin?: number;
		aMax?: number;
		xMin?: number;
		xMax?: number;
		yMin?: number;
		yMax?: number;
		transientIterations?: number;
		theta1?: number;
		theta2?: number;
		omega1?: number;
		omega2?: number;
		l1?: number;
		l2?: number;
		m1?: number;
		m2?: number;
		gravity?: number;
		damping?: number;
		speed?: number;
		trailLength?: number;
		// Non-numeric params
		renderMode?: string;
		colorMode?: string;
		opacity?: number;
		pointSize?: number;
		zoom?: number;
		// State flags
		running?: boolean;
		diverged?: boolean;
		restartSignal?: number;
		divergenceValue?: number;
		value?: number;
		// DOM element bindings
		containerElement?: HTMLElement | undefined;
		head?: number;
		seeds?: unknown;
		children?: Snippet;
	};

	let {
		label = 'stub',
		a = $bindable(0),
		b = $bindable(0),
		c = $bindable(0),
		d = $bindable(0),
		u = $bindable(0),
		r = $bindable(0),
		k = $bindable(0),
		alpha = $bindable(0),
		beta = $bindable(0),
		gamma = $bindable(0),
		x0 = $bindable(0),
		y0 = $bindable(0),
		iterations = $bindable(0),
		burnIn = $bindable(0),
		numP = $bindable(0),
		numQ = $bindable(0),
		maxIterations = $bindable(0),
		rMin = $bindable(0),
		rMax = $bindable(0),
		aMin = $bindable(0),
		aMax = $bindable(0),
		xMin = $bindable(0),
		xMax = $bindable(0),
		yMin = $bindable(0),
		yMax = $bindable(0),
		transientIterations = $bindable(0),
		theta1 = $bindable(0),
		theta2 = $bindable(0),
		omega1 = $bindable(0),
		omega2 = $bindable(0),
		l1 = $bindable(0),
		l2 = $bindable(0),
		m1 = $bindable(0),
		m2 = $bindable(0),
		gravity = $bindable(0),
		damping = $bindable(0),
		speed = $bindable(0),
		trailLength = $bindable(0),
		renderMode = $bindable(''),
		colorMode = $bindable(''),
		opacity = $bindable(0),
		pointSize = $bindable(0),
		zoom = $bindable(0),
		running = $bindable(true),
		diverged = $bindable(false),
		restartSignal = $bindable(0),
		divergenceValue = $bindable(0),
		value = $bindable(0),
		containerElement = $bindable<HTMLElement | undefined>(undefined),
		head = $bindable(0),
		seeds = $bindable<unknown>(undefined),
		children
	}: Props = $props();

	function touchAll() {
		// Write back to every bindable prop to trigger parent setters
		a = a;
		b = b;
		c = c;
		d = d;
		u = u;
		r = r;
		k = k;
		alpha = alpha;
		beta = beta;
		gamma = gamma;
		x0 = x0;
		y0 = y0;
		iterations = iterations;
		burnIn = burnIn;
		numP = numP;
		numQ = numQ;
		maxIterations = maxIterations;
		rMin = rMin;
		rMax = rMax;
		aMin = aMin;
		aMax = aMax;
		xMin = xMin;
		xMax = xMax;
		yMin = yMin;
		yMax = yMax;
		transientIterations = transientIterations;
		theta1 = theta1;
		theta2 = theta2;
		omega1 = omega1;
		omega2 = omega2;
		l1 = l1;
		l2 = l2;
		m1 = m1;
		m2 = m2;
		gravity = gravity;
		damping = damping;
		speed = speed;
		trailLength = trailLength;
		renderMode = renderMode;
		colorMode = colorMode;
		opacity = opacity;
		pointSize = pointSize;
		zoom = zoom;
		running = running;
		diverged = diverged;
		restartSignal = restartSignal;
		divergenceValue = divergenceValue;
		value = value;
		head = head;
		seeds = seeds;
		containerElement = containerElement;
	}

	// Write to all bindable props on mount so parent bind: setters are exercised
	onMount(touchAll);
</script>

<div
	data-testid={label}
	data-running={String(running)}
	data-diverged={String(diverged)}
	data-restart-signal={String(restartSignal)}
>
	<button type="button" data-testid="bindable-stub-touch" onclick={touchAll}> Touch </button>
	<button type="button" data-testid="stub-trigger-diverged" onclick={() => (diverged = true)}>
		Simulate diverged
	</button>
	{#if children}
		{@render children()}
	{/if}
</div>
