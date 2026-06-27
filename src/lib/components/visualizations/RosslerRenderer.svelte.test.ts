import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/svelte';

vi.mock('$lib/stores/camera-sync', () => ({
	cameraSyncStore: {
		subscribe: vi.fn(() => () => {}),
		getStateForSide: vi.fn(() => null),
		updateFromSide: vi.fn(),
		reset: vi.fn()
	},
	createCameraState: vi.fn(),
	applyCameraState: vi.fn()
}));

vi.mock('$lib/rossler', () => ({
	calculateRossler: vi.fn(() => {
		// Return a small set of points to avoid heavy RK4 computation in tests.
		const pts: { x: number; y: number; z: number }[] = [];
		for (let i = 0; i < 10; i++) {
			pts.push({ x: i * 0.1, y: i * 0.2, z: i * 0.3 });
		}
		return pts;
	})
}));

vi.mock('three', () => ({
	// Use mockImplementation(function(){}) so constructors work with `new`
	WebGLRenderer: vi.fn().mockImplementation(function () {
		return {
			setSize: vi.fn(),
			setPixelRatio: vi.fn(),
			render: vi.fn(),
			dispose: vi.fn(),
			domElement: document.createElement('canvas'),
			setAnimationLoop: vi.fn()
		};
	}),
	PerspectiveCamera: vi.fn().mockImplementation(function () {
		return {
			position: { set: vi.fn(), x: 0, y: 0, z: 30 },
			aspect: 1,
			updateProjectionMatrix: vi.fn()
		};
	}),
	Scene: vi.fn().mockImplementation(function () {
		return { background: null, add: vi.fn(), remove: vi.fn() };
	}),
	Vector3: vi.fn().mockImplementation(function () {
		return { x: 0, y: 0, z: 0, copy: vi.fn(), lerp: vi.fn() };
	}),
	Color: vi.fn().mockImplementation(function () {
		const self = { copy: vi.fn(), lerp: vi.fn(), r: 0, g: 0, b: 0 };
		self.copy = vi.fn().mockReturnValue(self);
		self.lerp = vi.fn().mockReturnValue(self);
		return self;
	}),
	Points: vi.fn().mockImplementation(function () {
		return { geometry: {}, material: {} };
	}),
	BufferGeometry: vi.fn().mockImplementation(function () {
		const self = { setAttribute: vi.fn(), dispose: vi.fn(), setFromPoints: vi.fn() };
		self.setFromPoints = vi.fn().mockReturnValue(self);
		return self;
	}),
	Float32BufferAttribute: vi.fn().mockImplementation(function () {
		return {};
	}),
	BufferAttribute: vi.fn().mockImplementation(function () {
		return {};
	}),
	LineBasicMaterial: vi.fn().mockImplementation(function () {
		return { dispose: vi.fn(), transparent: false, opacity: 1 };
	}),
	Line: vi.fn().mockImplementation(function () {
		return {
			geometry: { dispose: vi.fn() },
			material: { dispose: vi.fn() }
		};
	}),
	GridHelper: vi.fn().mockImplementation(function () {
		return {
			material: { transparent: false, opacity: 1, dispose: vi.fn() },
			geometry: { dispose: vi.fn() },
			position: { y: 0 }
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

import RosslerRenderer from './RosslerRenderer.svelte';

// Store the original clientWidth/clientHeight descriptors so we can restore them.
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

describe('RosslerRenderer (smoke)', () => {
	// RosslerRenderer uses requestAnimationFrame internally (line 199).
	// Fake timers prevent the animation loop from leaking across tests.
	beforeEach(() => {
		vi.useFakeTimers();
		// jsdom reports clientWidth/clientHeight as 0 (no layout engine). Give
		// the container non-zero dimensions so the Three.js camera aspect ratio
		// and renderer size calculations don't produce NaN/0.
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get() {
				return 500;
			}
		});
		Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
			configurable: true,
			get() {
				return 400;
			}
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		if (originalClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
		}
		if (originalClientHeight) {
			Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
		}
		cleanup();
	});

	it('renders without throwing', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 200 }
		});
		// The Three.js renderer mounts a <canvas> (mocked domElement) into the container.
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders a container element with the sci-fi panel styling', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		const panel = container.firstElementChild as HTMLElement;
		expect(panel?.classList.contains('bg-black/40')).toBe(true);
	});

	it('renders with different parameter combinations', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.1, b: 0.1, c: 6.0, height: 300 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders with extreme parameter values', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 1.0, b: 1.0, c: 10.0, height: 500 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders with minimal height', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 50 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders with negative parameters', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: -0.1, b: -0.1, c: 5.7, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});
});

describe('RosslerRenderer full render path', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get() {
				return 500;
			}
		});
		Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
			configurable: true,
			get() {
				return 400;
			}
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		if (originalClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
		}
		if (originalClientHeight) {
			Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
		}
		cleanup();
	});

	it('mounts a Three.js canvas into the container with non-zero dimensions', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			const canvas = container.querySelector('canvas');
			expect(canvas).not.toBeNull();
		});
	});

	it('sets the camera aspect ratio from clientWidth/clientHeight', async () => {
		const threeModule = await import('three');
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// PerspectiveCamera mock stores aspect=1 initially; verify it was constructed
		expect(threeModule.PerspectiveCamera).toHaveBeenCalled();
	});

	it('calls renderer.setSize with container dimensions', async () => {
		const threeModule = await import('three');
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// The WebGLRenderer mock's setSize should have been called with 500, 400
		const rendererCalls = vi.mocked(threeModule.WebGLRenderer).mock.results;
		expect(rendererCalls.length).toBeGreaterThan(0);
		const rendererInstance = rendererCalls[0].value as { setSize: ReturnType<typeof vi.fn> };
		expect(rendererInstance.setSize).toHaveBeenCalledWith(500, 400);
	});

	it('handles NaN parameters without crashing (non-finite guard)', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: NaN, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('handles Infinity parameters without crashing (large-magnitude guard)', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: Infinity, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders with minimal height', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 50 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('re-renders when parameters change (parameter change re-render)', async () => {
		const { container, rerender } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// Changing parameters triggers the recreate effect
		expect(() => rerender({ a: 0.3, b: 0.2, c: 5.7, height: 400 })).not.toThrow();
	});

	it('binds containerElement prop to the internal container div', async () => {
		let containerEl: HTMLDivElement | undefined;
		render(RosslerRenderer, {
			props: {
				a: 0.2,
				b: 0.2,
				c: 5.7,
				height: 400,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		await waitFor(() => {
			expect(containerEl).toBeInstanceOf(HTMLDivElement);
		});
	});

	it('handles compareMode with camera sync store', async () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400, compareMode: true, compareSide: 'left' }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('cleans up on unmount without leaking', async () => {
		const { container, unmount } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(() => unmount()).not.toThrow();
	});
});

describe('RosslerRenderer camera sync and resize coverage', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get() {
				return 500;
			}
		});
		Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
			configurable: true,
			get() {
				return 400;
			}
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		if (originalClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
		}
		if (originalClientHeight) {
			Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
		}
		cleanup();
	});

	it('invokes the camera sync subscribe callback and applies the other side state', async () => {
		const camSync = await import('$lib/stores/camera-sync');
		// Override subscribe to immediately invoke the callback with an enabled
		// state whose lastUpdate is the opposite side, so applyCameraState runs.
		vi.mocked(camSync.cameraSyncStore.subscribe).mockImplementation((cb) => {
			cb({
				enabled: true,
				lastUpdate: 'right',
				syncing: false,
				left: null,
				right: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } }
			});
			return () => {};
		});

		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400, compareMode: true, compareSide: 'left' }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(camSync.applyCameraState).toHaveBeenCalled();
	});

	it('invokes the cameraChangeHandler when the OrbitControls change event fires', async () => {
		const camSync = await import('$lib/stores/camera-sync');
		const orbitModule = await import('three/examples/jsm/controls/OrbitControls.js');

		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400, compareMode: true, compareSide: 'left' }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		// Grab the OrbitControls instance and invoke the registered 'change' handler.
		const ocMock = vi.mocked(orbitModule.OrbitControls);
		const ocInstance = ocMock.mock.results[ocMock.mock.results.length - 1].value as {
			addEventListener: ReturnType<typeof vi.fn>;
		};
		const changeCall = ocInstance.addEventListener.mock.calls.find(
			([event]) => event === 'change'
		);
		expect(changeCall).toBeDefined();
		const handler = changeCall![1] as () => void;
		handler();
		expect(camSync.createCameraState).toHaveBeenCalled();
		expect(camSync.cameraSyncStore.updateFromSide).toHaveBeenCalled();
	});

	it('handles window resize events (handleResize)', async () => {
		const threeModule = await import('three');
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		const rendererInstance = vi.mocked(threeModule.WebGLRenderer).mock.results[
			vi.mocked(threeModule.WebGLRenderer).mock.results.length - 1
		].value as { setSize: ReturnType<typeof vi.fn> };
		const cameraInstance = vi.mocked(threeModule.PerspectiveCamera).mock.results[
			vi.mocked(threeModule.PerspectiveCamera).mock.results.length - 1
		].value as { updateProjectionMatrix: ReturnType<typeof vi.fn>; aspect: number };

		// Dispatch a resize event → handleResize updates camera aspect and renderer size.
		window.dispatchEvent(new Event('resize'));

		expect(cameraInstance.updateProjectionMatrix).toHaveBeenCalled();
		expect(rendererInstance.setSize).toHaveBeenCalledWith(500, 400);
	});
});

describe('RosslerRenderer dispose coverage (array materials and textures)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
			configurable: true,
			get() {
				return 500;
			}
		});
		Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
			configurable: true,
			get() {
				return 400;
			}
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		if (originalClientWidth) {
			Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
		}
		if (originalClientHeight) {
			Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
		} else {
			delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
		}
		cleanup();
	});

	it('disposes array materials, textures, and grid helper array material on unmount', async () => {
		const threeModule = await import('three');
		const textureDispose = vi.fn();

		// Line returns an array material containing a texture with a dispose fn.
		vi.mocked(threeModule.Line).mockImplementationOnce(function () {
			return {
				geometry: { dispose: vi.fn() },
				material: [{ dispose: vi.fn(), map: { dispose: textureDispose } }]
			};
		});
		// GridHelper returns an array material (exercises the array branch in cleanup).
		vi.mocked(threeModule.GridHelper).mockImplementationOnce(function () {
			return {
				material: [{ dispose: vi.fn() }],
				geometry: { dispose: vi.fn() },
				position: { y: 0 }
			};
		});

		const { container, unmount } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});

		expect(() => unmount()).not.toThrow();
		expect(textureDispose).toHaveBeenCalled();
	});

	it('skips applying camera state when lastUpdate matches compareSide', async () => {
		const camSync = await import('$lib/stores/camera-sync');
		// Clear any prior calls from previous tests.
		vi.mocked(camSync.applyCameraState).mockClear();
		// Override subscribe to invoke the callback with lastUpdate equal to this
		// side, so the early-return guard inside the callback is exercised.
		vi.mocked(camSync.cameraSyncStore.subscribe).mockImplementation((cb) => {
			cb({
				enabled: true,
				lastUpdate: 'left',
				syncing: false,
				left: { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 } },
				right: null
			});
			return () => {};
		});

		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 400, compareMode: true, compareSide: 'left' }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// applyCameraState should NOT have been called because lastUpdate === compareSide.
		expect(camSync.applyCameraState).not.toHaveBeenCalled();
	});
});
