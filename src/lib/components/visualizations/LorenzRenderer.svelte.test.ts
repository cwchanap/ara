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

// Shared spy for PerspectiveCamera.position.set so the zoom/viewMode rerender
// test can verify the synchronous applyCameraPosition effect actually ran.
const { perspectiveCameraPositionSet } = vi.hoisted(() => ({
	perspectiveCameraPositionSet: vi.fn()
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
			position: { set: perspectiveCameraPositionSet, x: 0, y: 0, z: 30 },
			aspect: 1,
			updateProjectionMatrix: vi.fn()
		};
	}),
	OrthographicCamera: vi.fn().mockImplementation(function () {
		return {
			position: { set: vi.fn(), x: 0, y: 0, z: 30 },
			left: -10,
			right: 10,
			top: 10,
			bottom: -10,
			zoom: 1,
			lookAt: vi.fn(),
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
		const self = { r: 0, g: 0, b: 0 } as {
			r: number;
			g: number;
			b: number;
			copy: ReturnType<typeof vi.fn>;
			lerp: ReturnType<typeof vi.fn>;
		};
		self.copy = vi.fn().mockReturnValue(self);
		self.lerp = vi.fn().mockReturnValue(self);
		return self;
	}),
	Points: vi.fn().mockImplementation(function () {
		return { geometry: {}, material: {} };
	}),
	BufferGeometry: vi.fn().mockImplementation(function () {
		return { setAttribute: vi.fn(), dispose: vi.fn(), setFromPoints: vi.fn().mockReturnThis() };
	}),
	Float32BufferAttribute: vi.fn().mockImplementation(function () {
		return {};
	}),
	BufferAttribute: vi.fn().mockImplementation(function () {
		return {};
	}),
	PointsMaterial: vi.fn().mockImplementation(function () {
		return { dispose: vi.fn() };
	}),
	LineBasicMaterial: vi.fn().mockImplementation(function () {
		return { dispose: vi.fn(), transparent: false, opacity: 1 };
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

vi.mock('three/examples/jsm/controls/OrbitControls.js', () => {
	(
		globalThis as unknown as { capturedOrbitListeners: Record<string, unknown[]> }
	).capturedOrbitListeners = {};
	return {
		OrbitControls: vi.fn().mockImplementation(function () {
			return {
				enableDamping: false,
				enabled: true,
				autoRotate: false,
				autoRotateSpeed: 0,
				target: { x: 0, y: 0, z: 0, set: vi.fn() },
				update: vi.fn(),
				dispose: vi.fn(),
				addEventListener: vi.fn((event: string, handler: unknown) => {
					const listeners = (
						globalThis as unknown as {
							capturedOrbitListeners: Record<string, unknown[]>;
						}
					).capturedOrbitListeners;
					if (!listeners[event]) {
						listeners[event] = [];
					}
					listeners[event].push(handler);
				}),
				removeEventListener: vi.fn()
			};
		})
	};
});

// Shared spies for Line2 geometry methods, hoisted so they are available inside
// the vi.mock factory below and in test bodies. Using shared spies (instead of a
// fresh vi.fn() per `new Line2()` instance) lets rerender tests assert that the
// rAF-driven updateDraw() pipeline actually pushed new geometry/colors after a
// prop change — verifying the effect ran, not just that the rerender didn't throw.
const { line2SetPositions, line2SetColors } = vi.hoisted(() => ({
	line2SetPositions: vi.fn(),
	line2SetColors: vi.fn()
}));

vi.mock('three/examples/jsm/lines/Line2.js', () => ({
	Line2: vi.fn().mockImplementation(function () {
		return {
			visible: true,
			geometry: {
				dispose: vi.fn(),
				setPositions: line2SetPositions,
				setColors: line2SetColors,
				instanceCount: 10
			},
			material: { dispose: vi.fn(), resolution: { set: vi.fn() } },
			computeLineDistances: vi.fn()
		};
	})
}));

vi.mock('three/examples/jsm/lines/LineGeometry.js', () => ({
	LineGeometry: vi.fn().mockImplementation(function () {
		return { setPositions: vi.fn(), setColors: vi.fn(), dispose: vi.fn() };
	})
}));

vi.mock('three/examples/jsm/lines/LineMaterial.js', () => ({
	LineMaterial: vi.fn().mockImplementation(function () {
		return { dispose: vi.fn(), resolution: { set: vi.fn() } };
	})
}));

import LorenzRenderer from './LorenzRenderer.svelte';
import { cameraSyncStore, applyCameraState } from '$lib/stores/camera-sync';

describe('LorenzRenderer (smoke)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders without throwing', async () => {
		const { container } = render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		});
		// The Three.js renderer mounts a <canvas> (mocked domElement) into the container.
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
	});

	it('renders a container element with the sci-fi panel styling', async () => {
		const { container } = render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		const panel = container.firstElementChild as HTMLElement;
		expect(panel?.classList.contains('bg-black/40')).toBe(true);
	});
});

describe('LorenzRenderer with different props', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders with custom sigma, rho, beta values', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: { params: { type: 'lorenz', sigma: 15, rho: 35, beta: 1.5 }, height: 200 }
			})
		).not.toThrow();
	});

	it('renders with different height', () => {
		const { container } = render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 400 }
		});
		const wrapper = container.querySelector('div');
		expect(wrapper?.getAttribute('style')).toContain('400px');
	});

	it('displays LIVE_RENDER label', () => {
		const { container } = render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		});
		expect(container.textContent).toContain('LIVE_RENDER');
	});
});

describe('LorenzRenderer compare mode', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders in compare mode with left side', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
					height: 200,
					compareMode: true,
					compareSide: 'left'
				}
			})
		).not.toThrow();
	});

	it('renders in compare mode with right side', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
					height: 200,
					compareMode: true,
					compareSide: 'right'
				}
			})
		).not.toThrow();
	});
});

describe('LorenzRenderer Three.js integration', () => {
	afterEach(() => {
		cleanup();
	});

	it('creates Three.js scene objects', async () => {
		const THREE = await import('three');
		render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		});
		expect(THREE.WebGLRenderer).toHaveBeenCalled();
		expect(THREE.Scene).toHaveBeenCalled();
		expect(THREE.PerspectiveCamera).toHaveBeenCalled();
		expect(THREE.GridHelper).toHaveBeenCalled();
	});

	it('creates OrbitControls and Line2', async () => {
		const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
		const { Line2 } = await import('three/examples/jsm/lines/Line2.js');
		render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		});
		expect(OrbitControls).toHaveBeenCalled();
		expect(Line2).toHaveBeenCalled();
	});
});

describe('LorenzRenderer engine behavior', () => {
	afterEach(() => {
		cleanup();
	});

	it('constructs an OrthographicCamera for projection support', async () => {
		const THREE = await import('three');
		render(LorenzRenderer, {
			props: {
				params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, viewMode: 'xy' },
				height: 200
			}
		});
		expect(THREE.OrthographicCamera).toHaveBeenCalled();
	});

	it('creates two Line2 instances (main + ghost) when ghost is enabled', async () => {
		const { Line2 } = await import('three/examples/jsm/lines/Line2.js');
		(Line2 as unknown as { mockClear: () => void }).mockClear?.();
		render(LorenzRenderer, {
			props: {
				params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, showGhost: true },
				height: 200
			}
		});
		expect(
			(Line2 as unknown as { mock: { calls: unknown[] } }).mock.calls.length
		).toBeGreaterThanOrEqual(2);
	});

	it('renders in compare mode without throwing', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
					height: 200,
					compareMode: true,
					compareSide: 'left'
				}
			})
		).not.toThrow();
	});
});

describe('LorenzRenderer resize and view modes and unmount', () => {
	let capturedCallback: (() => void) | null = null;

	beforeEach(() => {
		capturedCallback = null;
		globalThis.ResizeObserver = class {
			constructor(callback: () => void) {
				capturedCallback = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	});

	afterEach(() => {
		cleanup();
	});

	it('handles xz and yz orthographic view modes', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: {
						type: 'lorenz',
						sigma: 10,
						rho: 28,
						beta: 2.667,
						viewMode: 'xz',
						zoom: 1.5
					},
					height: 200
				}
			})
		).not.toThrow();

		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: {
						type: 'lorenz',
						sigma: 10,
						rho: 28,
						beta: 2.667,
						viewMode: 'yz',
						zoom: 1
					},
					height: 200
				}
			})
		).not.toThrow();
	});

	it('handles autoRotate true and false settings', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, autoRotate: true },
					height: 200
				}
			})
		).not.toThrow();

		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, autoRotate: false },
					height: 200
				}
			})
		).not.toThrow();
	});

	it('responds to window resize and ResizeObserver changes', () => {
		render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 } }
		});

		// Trigger window resize
		window.dispatchEvent(new Event('resize'));

		// Trigger ResizeObserver callback
		if (capturedCallback) {
			capturedCallback();
		}
	});

	it('cleans up properly on unmount', () => {
		const { unmount } = render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, showGhost: true } }
		});
		expect(() => unmount()).not.toThrow();
	});

	it('handles head=0 and isPlaying=false (slice count < 2)', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
					height: 200,
					isPlaying: false,
					head: 0
				}
			})
		).not.toThrow();
	});

	it('triggers compare mode rebuild when params change', async () => {
		const { rerender } = render(LorenzRenderer, {
			props: {
				params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667, trailLength: 5000 },
				height: 200,
				compareMode: true,
				compareSide: 'left'
			}
		});
		// Rerender with different sigma to trigger the rebuild effect
		await rerender({
			params: { type: 'lorenz', sigma: 11, rho: 28, beta: 2.667, trailLength: 5000 },
			height: 200,
			compareMode: true,
			compareSide: 'left'
		});
	});

	it('skips computeLineDistances when instanceCount is null', async () => {
		const { Line2 } = await import('three/examples/jsm/lines/Line2.js');
		const line2Mock = Line2 as unknown as ReturnType<typeof vi.fn> & {
			getMockImplementation?: () => (() => unknown) | undefined;
		};
		const originalMock = line2Mock.getMockImplementation?.();
		line2Mock.mockImplementation(function () {
			return {
				visible: true,
				geometry: {
					dispose: vi.fn(),
					setPositions: vi.fn(),
					setColors: vi.fn(),
					instanceCount: null
				},
				material: { dispose: vi.fn(), resolution: { set: vi.fn() } },
				computeLineDistances: vi.fn()
			};
		});
		expect(() =>
			render(LorenzRenderer, {
				props: {
					params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
					height: 200
				}
			})
		).not.toThrow();
		// Restore original mock
		if (originalMock) {
			line2Mock.mockImplementation(originalMock);
		} else {
			line2Mock.mockRestore();
		}
	});
});

describe('LorenzRenderer prop changes and effects', () => {
	afterEach(() => {
		cleanup();
		vi.mocked(cameraSyncStore.subscribe).mockReturnValue(() => {});
		vi.mocked(applyCameraState).mockClear();
		line2SetPositions.mockClear();
		line2SetColors.mockClear();
		perspectiveCameraPositionSet.mockClear();
	});

	const baseParams = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };

	it('recomputes colors when colorMode changes via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, colorMode: 'time' }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		line2SetPositions.mockClear();
		line2SetColors.mockClear();
		await rerender({
			params: { ...baseParams, colorMode: 'speed' },
			height: 200
		});
		// applyColors() invalidates the draw cache; the next updateDraw() (rAF)
		// must push the recomputed colors. Verifies the colorMode effect ran.
		await waitFor(() => {
			expect(line2SetColors).toHaveBeenCalled();
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('rebuilds when solver changes via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, solver: 'euler' }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// Reset after initial mount so we only observe post-rerender activity.
		line2SetPositions.mockClear();
		line2SetColors.mockClear();
		await rerender({
			params: { ...baseParams, solver: 'rk4' },
			height: 200
		});
		// rebuild() invalidates the draw cache; the next updateDraw() (rAF) must
		// push the new trajectory geometry to the line. Verifies the rebuild effect
		// propagated to the render pipeline, not just that rerender didn't throw.
		await waitFor(() => {
			expect(line2SetPositions).toHaveBeenCalled();
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles trailStyle comet via rerender', async () => {
		// trailStyle is not in any $effect dependency list; it is only read inside
		// updateDraw() (rAF loop). There is no synchronous mock-level observable for
		// a trailStyle rerender, so this remains a smoke check (rerender + canvas
		// survives). The comet windowing is exercised indirectly via the rAF loop.
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, trailStyle: 'cumulative' }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({
			params: { ...baseParams, trailStyle: 'comet' },
			height: 200
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('advances head when stepNonce changes via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: baseParams, height: 200, stepNonce: 0, isPlaying: false }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		line2SetPositions.mockClear();
		line2SetColors.mockClear();
		await rerender({
			params: baseParams,
			height: 200,
			stepNonce: 1,
			isPlaying: false
		});
		// isPlaying=false means the rAF loop's advanceHead(false) is a no-op, so
		// the only thing that advances head is the stepNonce effect's
		// advanceHead(true). The next updateDraw() must push the new slice.
		await waitFor(() => {
			expect(line2SetPositions).toHaveBeenCalled();
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('resets head when resetNonce changes via rerender', async () => {
		// resetNonce sets head=0; updateDraw() then early-returns (slice count < 2)
		// without calling setPositions/setColors, so the Line2 geometry spies cannot
		// observe the reset. The observable would be line.visible=false, but
		// `visible` is a plain property on the mock, not a spy. Smoke check only.
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: baseParams, height: 200, resetNonce: 0 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({
			params: baseParams,
			height: 200,
			resetNonce: 1
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles speed change via rerender', async () => {
		// speed is not tracked by any $effect; it is read inside advanceHead()
		// (rAF loop). With isPlaying defaulting to true the loop advances head
		// every frame regardless of speed, so a setPositions spy assertion could
		// pass for the wrong reason (animation ticked). Smoke check only.
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, speed: 1 }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({
			params: { ...baseParams, speed: 5 },
			height: 200
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles zoom change via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, zoom: 1 }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		perspectiveCameraPositionSet.mockClear();
		await rerender({
			params: { ...baseParams, zoom: 2 },
			height: 200
		});
		// The zoom effect calls applyCameraPosition() synchronously, which sets
		// the perspective camera position. Verifies the camera effect ran.
		await waitFor(() => {
			expect(perspectiveCameraPositionSet).toHaveBeenCalled();
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles autoRotate/rotationSpeed change via rerender', async () => {
		// applyOrbitSettings() runs synchronously and assigns orbit.autoRotate /
		// autoRotateSpeed, but those are plain-property assignments on the
		// OrbitControls mock (no setter/spy), so they are not observable without
		// invasive mock surgery. Smoke check only.
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, autoRotate: true, rotationSpeed: 1 }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({
			params: { ...baseParams, autoRotate: false, rotationSpeed: 0 },
			height: 200
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles trailLength change via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: { ...baseParams, trailLength: 5000 }, height: 200 }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		line2SetPositions.mockClear();
		line2SetColors.mockClear();
		await rerender({
			params: { ...baseParams, trailLength: 10000 },
			height: 200
		});
		// trailLength is in the rebuild effect's dependency list; rebuild()
		// invalidates the draw cache so the next updateDraw() pushes new geometry.
		await waitFor(() => {
			expect(line2SetPositions).toHaveBeenCalled();
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('handles isPlaying toggle via rerender', async () => {
		// isPlaying gates advanceHead() inside the rAF loop. Asserting the
		// stop/resume of setPositions calls across a true→false→true toggle is
		// timing-fragile (depends on exactly which rAF tick fires between
		// rerenders), so this remains a smoke check.
		const { rerender, container } = render(LorenzRenderer, {
			props: { params: baseParams, height: 200, isPlaying: true }
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		await rerender({
			params: baseParams,
			height: 200,
			isPlaying: false
		});
		await rerender({
			params: baseParams,
			height: 200,
			isPlaying: true
		});
		expect(container.querySelector('canvas')).not.toBeNull();
	});

	it('binds containerElement to the rendered div', async () => {
		let containerEl: HTMLDivElement | undefined;
		const { container } = render(LorenzRenderer, {
			props: {
				params: baseParams,
				height: 200,
				get containerElement() {
					return containerEl;
				},
				set containerElement(next: HTMLDivElement | undefined) {
					containerEl = next;
				}
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		expect(containerEl).toBeInstanceOf(HTMLDivElement);
	});

	it('applies camera state from sync store in compare mode', async () => {
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
		render(LorenzRenderer, {
			props: { params: baseParams, height: 200, compareMode: true, compareSide: 'left' }
		});
		await waitFor(() => {
			expect(applyCameraState).toHaveBeenCalled();
		});
	});

	it('renders with all color modes without throwing', async () => {
		for (const colorMode of ['time', 'speed', 'zheight', 'divergence', 'single'] as const) {
			const { container, unmount } = render(LorenzRenderer, {
				props: { params: { ...baseParams, colorMode }, height: 200 }
			});
			await waitFor(() => {
				expect(container.querySelector('canvas')).not.toBeNull();
			});
			unmount();
		}
	});

	it('renders with all solver types without throwing', async () => {
		for (const solver of ['euler', 'rk2', 'rk4'] as const) {
			const { container, unmount } = render(LorenzRenderer, {
				props: { params: { ...baseParams, solver }, height: 200 }
			});
			await waitFor(() => {
				expect(container.querySelector('canvas')).not.toBeNull();
			});
			unmount();
		}
	});
});

describe('LorenzRenderer stationary trail style', () => {
	// Line2 mock instances persist across tests; clear so mock.results indices
	// map cleanly to mainLine (results[0]) and ghostLine (results[1]).
	beforeEach(async () => {
		const { Line2 } = await import('three/examples/jsm/lines/Line2.js');
		(Line2 as unknown as { mockClear: () => void }).mockClear();
	});

	afterEach(() => {
		cleanup();
		line2SetPositions.mockClear();
		line2SetColors.mockClear();
	});

	const baseParams = { type: 'lorenz' as const, sigma: 10, rho: 28, beta: 2.667 };

	// head is not observable via the bindable prop (@testing-library/svelte
	// limitation — writes don't propagate back to the test). Instead, infer head
	// from the positions subarray length pushed to Line2: in stationary mode
	// from=0, to=head, so subarray length = head * 3. When head=0 the line is
	// hidden (visible=false) and setPositions is not called.
	async function getMainLine() {
		const { Line2 } = await import('three/examples/jsm/lines/Line2.js');
		const mock = Line2 as unknown as { mock: { results: { value: { visible: boolean } }[] } };
		return mock.mock.results[0]!.value;
	}

	it('pins head to trailLength on initial mount in stationary mode', async () => {
		const { container } = render(LorenzRenderer, {
			props: {
				params: { ...baseParams, trailStyle: 'stationary', trailLength: 5000 },
				height: 200,
				isPlaying: false
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		// rebuild() pins head = trailLength; updateDraw pushes full trajectory.
		await waitFor(() => {
			expect(line2SetPositions).toHaveBeenCalled();
		});
		const lastCall = line2SetPositions.mock.calls.at(-1)?.[0];
		expect(lastCall?.length).toBe(5000 * 3);
	});

	it('snaps head to trailLength when entering stationary via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: {
				params: { ...baseParams, trailStyle: 'comet', trailLength: 5000 },
				height: 200,
				isPlaying: false
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		line2SetPositions.mockClear();
		await rerender({
			params: { ...baseParams, trailStyle: 'stationary', trailLength: 5000 },
			height: 200,
			isPlaying: false
		});
		// Trail-style transition effect sets head = trailLength.
		await waitFor(() => {
			expect(line2SetPositions).toHaveBeenCalled();
		});
		const lastCall = line2SetPositions.mock.calls.at(-1)?.[0];
		expect(lastCall?.length).toBe(5000 * 3);
	});

	it('resets head to 0 when leaving stationary via rerender', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: {
				params: { ...baseParams, trailStyle: 'stationary', trailLength: 5000 },
				height: 200,
				isPlaying: false
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		const mainLine = await getMainLine();
		expect(mainLine.visible).toBe(true);
		await rerender({
			params: { ...baseParams, trailStyle: 'comet', trailLength: 5000 },
			height: 200,
			isPlaying: false
		});
		// Trail-style transition effect sets head = 0; updateDraw sees
		// slice count < 2 and hides the line (visible = false).
		await waitFor(() => {
			expect(mainLine.visible).toBe(false);
		});
	});

	it('does not reset head to 0 on resetNonce while stationary', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: {
				params: { ...baseParams, trailStyle: 'stationary', trailLength: 5000 },
				height: 200,
				isPlaying: false,
				resetNonce: 0
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		const mainLine = await getMainLine();
		expect(mainLine.visible).toBe(true);
		await rerender({
			params: { ...baseParams, trailStyle: 'stationary', trailLength: 5000 },
			height: 200,
			isPlaying: false,
			resetNonce: 1
		});
		// Without the guard, resetNonce would set head=0, causing updateDraw to
		// hide the line (visible=false). With the guard, head stays pinned at
		// trailLength and the cache prevents updateDraw from touching visible.
		await new Promise((r) => setTimeout(r, 150));
		expect(mainLine.visible).toBe(true);
	});

	it('re-pins head to trailLength when trailLength changes while stationary', async () => {
		const { rerender, container } = render(LorenzRenderer, {
			props: {
				params: { ...baseParams, trailStyle: 'stationary', trailLength: 5000 },
				height: 200,
				isPlaying: false
			}
		});
		await waitFor(() => {
			expect(container.querySelector('canvas')).not.toBeNull();
		});
		line2SetPositions.mockClear();
		await rerender({
			params: { ...baseParams, trailStyle: 'stationary', trailLength: 10000 },
			height: 200,
			isPlaying: false
		});
		// rebuild() fires on trailLength change and re-pins head to new value.
		await waitFor(() => {
			expect(line2SetPositions).toHaveBeenCalled();
		});
		const lastCall = line2SetPositions.mock.calls.at(-1)?.[0];
		expect(lastCall?.length).toBe(10000 * 3);
	});
});
