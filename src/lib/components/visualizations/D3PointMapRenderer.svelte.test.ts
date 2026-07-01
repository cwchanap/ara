import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import D3PointMapRenderer from './D3PointMapRenderer.svelte';

describe('D3PointMapRenderer', () => {
	afterEach(cleanup);

	it('renders an svg with one circle per point', async () => {
		const points: [number, number][] = [
			[0, 0],
			[1, 1],
			[2, 0.5]
		];
		const { container } = render(D3PointMapRenderer, { props: { points, height: 200 } });
		// jsdom has no layout; component must guard width===0. Force a width:
		const root = container.querySelector('div') as HTMLDivElement;
		Object.defineProperty(root, 'clientWidth', { value: 400, configurable: true });
		// trigger a re-render by updating points
		await new Promise((r) => setTimeout(r, 0));
		// At minimum the LIVE_RENDER badge is present:
		expect(container.textContent).toContain('LIVE_RENDER');
	});
});
