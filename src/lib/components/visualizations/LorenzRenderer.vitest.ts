import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';

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
	(globalThis as unknown as Record<string, unknown>).capturedOrbitListeners = {};
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
					const listeners = (globalThis as unknown as Record<string, unknown[]>)
						.capturedOrbitListeners;
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

vi.mock('three/examples/jsm/lines/Line2.js', () => ({
	Line2: vi.fn().mockImplementation(function () {
		return {
			visible: true,
			geometry: {
				dispose: vi.fn(),
				setPositions: vi.fn(),
				setColors: vi.fn(),
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

describe('LorenzRenderer (smoke)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders without throwing', () => {
		expect(() =>
			render(LorenzRenderer, {
				props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
			})
		).not.toThrow();
	});

	it('renders a container element', () => {
		const { container } = render(LorenzRenderer, {
			props: { params: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }, height: 200 }
		});
		expect(container.querySelector('div')).not.toBeNull();
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
