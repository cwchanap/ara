import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';

vi.mock('$lib/stores/camera-sync', () => ({
	cameraSyncStore: {
		subscribe: vi.fn(() => () => {}),
		getStateForSide: vi.fn(() => null),
		updateFromSide: vi.fn(),
		reset: vi.fn()
	},
	createCameraState: vi.fn(() => ({ position: [0, 0, 0], target: [0, 0, 0], zoom: 1 })),
	applyCameraState: vi.fn()
}));

vi.mock('$lib/chua', () => ({
	calculateChua: vi.fn(() => ({
		points: [
			{ x: 1, y: 2, z: 3 },
			{ x: 4, y: 5, z: 6 },
			{ x: 7, y: 8, z: 9 }
		],
		diverged: true
	})),
	computePoincareSection: vi.fn(() => [
		{ u: 1, v: 2 },
		{ u: 3, v: 4 }
	])
}));

vi.mock('three', () => ({
	WebGLRenderer: vi.fn().mockImplementation(function () {
		return {
			setSize: vi.fn(),
			setPixelRatio: vi.fn(),
			render: vi.fn(),
			dispose: vi.fn(),
			domElement: document.createElement('canvas')
		};
	}),
	PerspectiveCamera: vi.fn().mockImplementation(function () {
		return {
			position: { set: vi.fn(), x: 0, y: 0, z: 18 },
			aspect: 1,
			updateProjectionMatrix: vi.fn(),
			up: { set: vi.fn() },
			lookAt: vi.fn()
		};
	}),
	OrthographicCamera: vi.fn().mockImplementation(function () {
		return {
			left: -10,
			right: 10,
			top: 10,
			bottom: -10,
			near: 0.1,
			far: 2000,
			updateProjectionMatrix: vi.fn(),
			up: { set: vi.fn() },
			position: { set: vi.fn() },
			lookAt: vi.fn()
		};
	}),
	Scene: vi.fn().mockImplementation(function () {
		return { background: null, add: vi.fn(), remove: vi.fn() };
	}),
	Color: vi.fn().mockImplementation(function () {
		const self = { r: 0, g: 0, b: 0 };
		(self as unknown as { copy: () => unknown }).copy = vi.fn().mockReturnValue(self);
		(self as unknown as { lerp: () => unknown }).lerp = vi.fn().mockReturnValue(self);
		return self;
	}),
	Vector3: vi.fn().mockImplementation(function () {
		return { x: 0, y: 0, z: 0, set: vi.fn(), copy: vi.fn(), lerp: vi.fn() };
	}),
	Line: vi.fn().mockImplementation(function (geometry: unknown, material: unknown) {
		return {
			geometry,
			material,
			visible: true
		};
	}),
	Points: vi.fn().mockImplementation(function (geometry: unknown, material: unknown) {
		return {
			geometry,
			material,
			visible: false
		};
	}),
	BufferGeometry: vi.fn().mockImplementation(function () {
		const attributes = new Map<string, unknown>();
		return {
			setAttribute: vi.fn((name: string, attr: unknown) => {
				attributes.set(name, attr);
			}),
			getAttribute: vi.fn((name: string) => attributes.get(name)),
			dispose: vi.fn()
		};
	}),
	BufferAttribute: vi.fn().mockImplementation(function (data: Float32Array, itemSize: number) {
		return {
			data,
			itemSize,
			count: Math.floor(data.length / itemSize),
			getX: (i: number) => data[i * itemSize],
			getY: (i: number) => data[i * itemSize + 1],
			getZ: (i: number) => data[i * itemSize + 2]
		};
	}),
	Float32BufferAttribute: vi.fn().mockImplementation(function (
		data: Float32Array,
		itemSize: number
	) {
		return { data, itemSize, count: Math.floor(data.length / itemSize) };
	}),
	LineBasicMaterial: vi.fn().mockImplementation(function () {
		return { dispose: vi.fn(), transparent: false, opacity: 1 };
	}),
	PointsMaterial: vi.fn().mockImplementation(function () {
		return { dispose: vi.fn(), size: 3, sizeAttenuation: false };
	}),
	GridHelper: vi.fn().mockImplementation(function () {
		return {
			material: { transparent: false, opacity: 1, dispose: vi.fn() },
			geometry: { dispose: vi.fn() },
			position: { y: 0, set: vi.fn() }
		};
	}),
	AdditiveBlending: 2
}));

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
	OrbitControls: vi.fn().mockImplementation(function () {
		return {
			enableDamping: false,
			autoRotate: false,
			autoRotateSpeed: 0,
			target: { x: 0, y: 0, z: 0, set: vi.fn() },
			update: vi.fn(),
			dispose: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn()
		};
	})
}));

import ChuaRenderer from './ChuaRenderer.svelte';
import { calculateChua, computePoincareSection } from '$lib/chua';
import { cameraSyncStore, applyCameraState } from '$lib/stores/camera-sync';

describe('ChuaRenderer (smoke)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders without throwing', () => {
		expect(() => render(ChuaRenderer, { props: { height: 200 } })).not.toThrow();
	});

	it('renders a container element', () => {
		const { container } = render(ChuaRenderer, { props: { height: 200 } });
		expect(container.querySelector('div')).not.toBeNull();
	});

	it('displays CHUA_RENDERER label', () => {
		const { container } = render(ChuaRenderer, { props: { height: 200 } });
		expect(container.textContent).toContain('CHUA_RENDERER');
	});
});

describe('ChuaRenderer view modes', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders in 3d mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, viewMode: '3d' } })
		).not.toThrow();
	});

	it('renders in xy mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, viewMode: 'xy' } })
		).not.toThrow();
	});

	it('renders in xz mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, viewMode: 'xz' } })
		).not.toThrow();
	});

	it('renders in yz mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, viewMode: 'yz' } })
		).not.toThrow();
	});

	it('renders in poincare mode', () => {
		expect(() =>
			render(ChuaRenderer, {
				props: { height: 200, viewMode: 'poincare', poincarePlane: 'y=0' }
			})
		).not.toThrow();
	});
});

describe('ChuaRenderer color modes', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders with time color mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, colorMode: 'time' } })
		).not.toThrow();
	});

	it('renders with velocity color mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, colorMode: 'velocity' } })
		).not.toThrow();
	});

	it('renders with z-height color mode', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, colorMode: 'z-height' } })
		).not.toThrow();
	});
});

describe('ChuaRenderer compare mode', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders in compare mode with left side', () => {
		expect(() =>
			render(ChuaRenderer, {
				props: { height: 200, compareMode: true, compareSide: 'left' }
			})
		).not.toThrow();
	});

	it('renders in compare mode with right side', () => {
		expect(() =>
			render(ChuaRenderer, {
				props: { height: 200, compareMode: true, compareSide: 'right' }
			})
		).not.toThrow();
	});
});

describe('ChuaRenderer divergence warning', () => {
	afterEach(() => {
		cleanup();
	});

	it('shows divergence warning when diverged prop is true', () => {
		const { container } = render(ChuaRenderer, { props: { height: 200, diverged: true } });
		expect(container.textContent).toContain('TRAJECTORY DIVERGED');
	});
});

describe('ChuaRenderer Three.js integration', () => {
	afterEach(() => {
		cleanup();
	});

	it('creates Three.js scene objects', async () => {
		const THREE = await import('three');
		render(ChuaRenderer, { props: { height: 200 } });
		expect(THREE.WebGLRenderer).toHaveBeenCalled();
		expect(THREE.Scene).toHaveBeenCalled();
		expect(THREE.PerspectiveCamera).toHaveBeenCalled();
		expect(THREE.OrthographicCamera).toHaveBeenCalled();
		expect(THREE.GridHelper).toHaveBeenCalled();
		expect(THREE.Line).toHaveBeenCalled();
		expect(THREE.Points).toHaveBeenCalled();
	});
});

describe('ChuaRenderer advanced coverage', () => {
	afterEach(() => {
		cleanup();
		vi.mocked(calculateChua).mockReturnValue({
			points: [
				{ x: 1, y: 2, z: 3 },
				{ x: 4, y: 5, z: 6 },
				{ x: 7, y: 8, z: 9 }
			],
			diverged: true
		});
		vi.mocked(computePoincareSection).mockReturnValue([
			{ u: 1, v: 2 },
			{ u: 3, v: 4 }
		]);
		vi.mocked(cameraSyncStore.subscribe).mockReturnValue(() => {});
		vi.mocked(applyCameraState).mockClear();
	});

	it('renders with transientRemoval enabled', () => {
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, transientRemoval: true } })
		).not.toThrow();
	});

	it('cleans up on unmount without throwing', () => {
		const { unmount } = render(ChuaRenderer, { props: { height: 200 } });
		expect(() => unmount()).not.toThrow();
	});

	it('responds to window resize event', () => {
		render(ChuaRenderer, { props: { height: 200 } });
		expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
	});

	it('binds containerElement to the rendered div', () => {
		let containerEl: HTMLDivElement | undefined;
		render(ChuaRenderer, {
			props: {
				height: 200,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		expect(containerEl).toBeInstanceOf(HTMLDivElement);
	});

	it('applies camera state from sync store in compare mode', () => {
		vi.mocked(applyCameraState).mockClear();
		vi.mocked(cameraSyncStore.subscribe).mockImplementationOnce((cb) => {
			cb({
				enabled: true,
				lastUpdate: 'right',
				syncing: false,
				left: null,
				right: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } }
			});
			return () => {};
		});
		render(ChuaRenderer, {
			props: { height: 200, compareMode: true, compareSide: 'left' }
		});
		expect(applyCameraState).toHaveBeenCalled();
	});

	it('skips camera sync when state is disabled', () => {
		vi.mocked(cameraSyncStore.subscribe).mockImplementationOnce((cb) => {
			cb({ enabled: false, lastUpdate: 'right', syncing: false, left: null, right: null });
			return () => {};
		});
		render(ChuaRenderer, {
			props: { height: 200, compareMode: true, compareSide: 'left' }
		});
		expect(applyCameraState).not.toHaveBeenCalled();
	});

	it('skips camera sync when lastUpdate matches side', () => {
		vi.mocked(cameraSyncStore.subscribe).mockImplementationOnce((cb) => {
			cb({
				enabled: true,
				lastUpdate: 'left',
				syncing: false,
				left: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } },
				right: null
			});
			return () => {};
		});
		render(ChuaRenderer, {
			props: { height: 200, compareMode: true, compareSide: 'left' }
		});
		expect(applyCameraState).not.toHaveBeenCalled();
	});

	it('handles empty poincare section (frameBounds non-finite fallback)', () => {
		vi.mocked(computePoincareSection).mockReturnValueOnce([]);
		expect(() =>
			render(ChuaRenderer, {
				props: { height: 200, viewMode: 'poincare', poincarePlane: 'y=0' }
			})
		).not.toThrow();
	});

	it('handles single-point trajectory (colorArrayFor pts.length <= 1)', () => {
		vi.mocked(calculateChua).mockReturnValueOnce({
			points: [{ x: 1, y: 2, z: 3 }],
			diverged: false
		});
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, colorMode: 'time' } })
		).not.toThrow();
	});

	it('handles single-point trajectory with z-height color mode', () => {
		vi.mocked(calculateChua).mockReturnValueOnce({
			points: [{ x: 1, y: 2, z: 3 }],
			diverged: false
		});
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, colorMode: 'z-height' } })
		).not.toThrow();
	});

	it('handles single-point trajectory with velocity color mode', () => {
		vi.mocked(calculateChua).mockReturnValueOnce({
			points: [{ x: 1, y: 2, z: 3 }],
			diverged: false
		});
		expect(() =>
			render(ChuaRenderer, { props: { height: 200, colorMode: 'velocity' } })
		).not.toThrow();
	});

	it('rebuilds when math parameters change via rerender', async () => {
		const { rerender } = render(ChuaRenderer, {
			props: { height: 200, alpha: 15.6 }
		});
		await rerender({ height: 200, alpha: 16 });
		expect(vi.mocked(calculateChua).mock.calls.length).toBeGreaterThanOrEqual(2);
	});

	it('applies view mode change via rerender', async () => {
		const { rerender, container } = render(ChuaRenderer, {
			props: { height: 200, viewMode: '3d' }
		});
		await rerender({ height: 200, viewMode: 'xy' });
		expect(container.querySelector('div')).not.toBeNull();
	});
});
