# Ikeda Unit Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring patch coverage above 80% for the 5 Ikeda-related files flagged by Codecov.

**Architecture:** Add missing test cases to existing test files and expand svelte component tests to exercise more interaction paths (slider changes, select changes, color modes, worker branches, config loading).

**Tech Stack:** Vitest (node + jsdom projects), @testing-library/svelte, Svelte 5 runes

---

### Task 1: Cover `src/lib/ikeda.ts` partial branches (3 partials)

**Files:**

- Modify: `src/lib/ikeda.test.ts`

**Step 1: Add divergence break test for calculateIkeda**

Add a test that exercises the `!Number.isFinite(x) || !Number.isFinite(y)` break inside `calculateIkeda`. A very large `u` value (e.g. 1e10) causes the orbit to diverge immediately.

```typescript
test('stops early when values become non-finite', () => {
	const pts = calculateIkeda({ u: 1e10, x0: 1, y0: 1, iterations: 500, burnIn: 0 });
	for (const p of pts) {
		expect(Number.isFinite(p.x)).toBe(true);
		expect(Number.isFinite(p.y)).toBe(true);
	}
	expect(pts.length).toBeLessThan(500);
});
```

**Step 2: Add divergence break test for calculateIkedaTuples**

```typescript
test('stops early when values become non-finite', () => {
	const pts = calculateIkedaTuples({ u: 1e10, x0: 1, y0: 1, iterations: 500, burnIn: 0 });
	for (const [x, y] of pts) {
		expect(Number.isFinite(x)).toBe(true);
		expect(Number.isFinite(y)).toBe(true);
	}
	expect(pts.length).toBeLessThan(500);
});
```

**Step 3: Add negative maxPoints test for calculateIkedaMultiSeed**

```typescript
test('negative maxPoints yields no points', () => {
	const { points, seedIndices } = calculateIkedaMultiSeed({
		u: 0.918,
		iterations: 100,
		burnIn: 10,
		seeds: 50,
		maxPoints: -100
	});
	expect(points).toHaveLength(0);
	expect(seedIndices).toHaveLength(0);
});
```

**Step 4: Run tests**

Run: `bun run vitest run src/lib/ikeda.test.ts`
Expected: All tests pass

---

### Task 2: Cover `src/lib/workers/chaosMapsWorker.ts` ikeda branch (3 missing + 1 partial)

**Files:**

- Modify: `src/lib/workers/chaosMapsWorker.test.ts`

**Step 1: Add ikeda worker message tests**

```typescript
describe('ikeda map messages', () => {
	test('handles ikeda message type', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 100,
				u: 0.918,
				iterations: 100,
				burnIn: 20,
				seeds: 30,
				maxPoints: 200000
			}
		});
		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('ikedaResult');
		expect(responses[0]?.id).toBe(100);
		expect(responses[0]?.points.length).toBeGreaterThan(0);
	});

	test('ikeda response has parallel seedIndices', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 101,
				u: 0.918,
				iterations: 80,
				burnIn: 10,
				seeds: 25,
				maxPoints: 200000
			}
		});
		expect(responses[0]?.seedIndices).toHaveLength(responses[0]?.points?.length ?? 0);
	});

	test('ikeda honors maxPoints cap', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 102,
				u: 0.918,
				iterations: 200,
				burnIn: 10,
				seeds: 100,
				maxPoints: 50
			}
		});
		expect(responses[0]?.points).toHaveLength(50);
		expect(responses[0]?.seedIndices).toHaveLength(50);
	});

	test('ikeda with zero seeds returns empty', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 103,
				u: 0.918,
				iterations: 100,
				burnIn: 10,
				seeds: 0,
				maxPoints: 200000
			}
		});
		expect(responses[0]?.points).toHaveLength(0);
		expect(responses[0]?.seedIndices).toHaveLength(0);
	});
});
```

**Step 2: Run tests**

Run: `bun run vitest run src/lib/workers/chaosMapsWorker.test.ts`
Expected: All tests pass

---

### Task 3: Expand `IkedaRenderer.svelte.test.ts` coverage (63 missing + 14 partials)

**Files:**

- Modify: `src/lib/components/visualizations/IkedaRenderer.svelte.test.ts`

**Step 1: Add color mode tests**

Add tests exercising each colorMode branch ('single', 'seed', 'radius', 'iteration') and verify no errors:

```typescript
it('renders with colorMode "single"', async () => {
	const { container } = render(IkedaRenderer, {
		props: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'multi',
			seeds: 2,
			colorMode: 'single',
			pointSize: 1.5,
			opacity: 0.6,
			height: 200
		}
	});
	await waitFor(() => {
		expect(container.querySelector('svg')).not.toBeNull();
	});
});

it('renders with colorMode "seed"', async () => {
	const { container } = render(IkedaRenderer, {
		props: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'multi',
			seeds: 5,
			colorMode: 'seed',
			pointSize: 1.5,
			opacity: 0.6,
			height: 200
		}
	});
	await waitFor(() => {
		expect(container.querySelector('svg')).not.toBeNull();
	});
});

it('renders with colorMode "radius"', async () => {
	const { container } = render(IkedaRenderer, {
		props: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'multi',
			seeds: 2,
			colorMode: 'radius',
			pointSize: 1.5,
			opacity: 0.6,
			height: 200
		}
	});
	await waitFor(() => {
		expect(container.querySelector('svg')).not.toBeNull();
	});
});
```

**Step 2: Add containerElement binding test**

```typescript
it('binds containerElement to the rendered div', async () => {
	let containerEl: HTMLDivElement | undefined;
	const { container } = render(IkedaRenderer, {
		props: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'multi',
			seeds: 2,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6,
			height: 200,
			containerElement: containerEl
		}
	});
	await waitFor(() => {
		expect(container.querySelector('svg')).not.toBeNull();
	});
});
```

**Step 3: Add height variation test**

```typescript
it('applies custom height to the container', async () => {
	const { container } = render(IkedaRenderer, {
		props: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'multi',
			seeds: 2,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6,
			height: 400
		}
	});
	await waitFor(() => {
		const div = container.firstElementChild as HTMLElement;
		expect(div?.style.height).toContain('400');
	});
});
```

**Step 4: Add single-orbit mode with multiple iterations**

```typescript
it('renders multiple points in single-orbit mode', async () => {
	const { calculateIkedaTuples } = await import('$lib/ikeda');
	vi.mocked(calculateIkedaTuples).mockReturnValueOnce([
		[0, 0],
		[1, 0.5],
		[2, 1],
		[1.5, 0.8],
		[0.3, 0.2]
	]);
	const { container } = render(IkedaRenderer, {
		props: {
			u: 0.918,
			x0: 0.1,
			y0: 0,
			iterations: 100,
			burnIn: 10,
			renderMode: 'single',
			seeds: 2,
			colorMode: 'iteration',
			pointSize: 1.5,
			opacity: 0.6,
			height: 200
		}
	});
	await waitFor(() => {
		expect(container.querySelector('svg')).not.toBeNull();
		expect(container.querySelector('canvas')).not.toBeNull();
	});
});
```

**Step 5: Run tests**

Run: `bun run vitest run --project jsdom src/lib/components/visualizations/IkedaRenderer.svelte.test.ts`
Expected: All tests pass

---

### Task 4: Expand `ikeda-page-interactions.svelte.test.ts` (80 missing + 7 partials)

**Files:**

- Modify: `src/routes/ikeda-page-interactions.svelte.test.ts`

**Step 1: Add render mode select test**

```typescript
it('changes render mode via select', async () => {
	render(IkedaPage, { props: pageProps });
	const select = screen.getByTestId('select-render-mode') as HTMLSelectElement;
	await fireEvent.change(select, { target: { value: 'single' } });
	expect(select.value).toBe('single');
});
```

**Step 2: Add color mode select test**

```typescript
it('changes color mode via select', async () => {
	render(IkedaPage, { props: pageProps });
	const select = screen.getByTestId('select-color-mode') as HTMLSelectElement;
	await fireEvent.change(select, { target: { value: 'seed' } });
	expect(select.value).toBe('seed');
});
```

**Step 3: Add value display test**

```typescript
it('displays the current feedback value', () => {
	render(IkedaPage, { props: pageProps });
	expect(screen.getByTestId('value-u').textContent).toBe('0.918');
});
```

**Step 4: Add preset buttons render test**

```typescript
it('renders all preset buttons', () => {
	render(IkedaPage, { props: pageProps });
	expect(screen.getByRole('button', { name: /Classic Ikeda/i })).toBeTruthy();
	expect(screen.getByRole('button', { name: /Low Feedback/i })).toBeTruthy();
	expect(screen.getByRole('button', { name: /Transition/i })).toBeTruthy();
	expect(screen.getByRole('button', { name: /Structured Chaos/i })).toBeTruthy();
	expect(screen.getByRole('button', { name: /Dense Fractal/i })).toBeTruthy();
});
```

**Step 5: Add equation display test**

```typescript
it('displays the Ikeda equations', () => {
	render(IkedaPage, { props: pageProps });
	expect(screen.getByText(/t\(n\) = 0\.4/i)).toBeTruthy();
});
```

**Step 6: Run tests**

Run: `bun run vitest run --project jsdom src/routes/ikeda-page-interactions.svelte.test.ts`
Expected: All tests pass

---

### Task 5: Expand `ikeda-compare.svelte.test.ts` (28 missing + 15 partials)

**Files:**

- Modify: `src/routes/ikeda-compare.svelte.test.ts`

**Step 1: Add left/right slider interaction tests**

```typescript
import { fireEvent, screen } from '@testing-library/svelte';

it('renders left and right x0 sliders', () => {
	const { container } = render(IkedaComparePage);
	expect(container.querySelector('#left-x0')).not.toBeNull();
	expect(container.querySelector('#right-x0')).not.toBeNull();
});

it('renders left and right y0 sliders', () => {
	const { container } = render(IkedaComparePage);
	expect(container.querySelector('#left-y0')).not.toBeNull();
	expect(container.querySelector('#right-y0')).not.toBeNull();
});

it('renders left and right iterations sliders', () => {
	const { container } = render(IkedaComparePage);
	expect(container.querySelector('#left-iterations')).not.toBeNull();
	expect(container.querySelector('#right-iterations')).not.toBeNull();
});

it('renders left and right burnIn sliders', () => {
	const { container } = render(IkedaComparePage);
	expect(container.querySelector('#left-burnIn')).not.toBeNull();
	expect(container.querySelector('#right-burnIn')).not.toBeNull();
});

it('renders left and right render mode selects', () => {
	const { container } = render(IkedaComparePage);
	expect(container.querySelector('#left-renderMode')).not.toBeNull();
	expect(container.querySelector('#right-renderMode')).not.toBeNull();
});
```

**Step 2: Add ComparisonLayout mock test**

Mock ComparisonLayout and ComparisonParameterPanel (they are likely already needed). Add a test verifying both IkedaRenderer instances mount.

**Step 3: Run tests**

Run: `bun run vitest run --project jsdom src/routes/ikeda-compare.svelte.test.ts`
Expected: All tests pass

---

### Task 6: Run full test suite and verify

**Step 1: Run full test suite**

Run: `bun run test`
Expected: All tests pass

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors
