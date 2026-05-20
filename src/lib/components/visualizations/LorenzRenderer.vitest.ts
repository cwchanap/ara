import { afterEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('three/examples/jsm/lines/Line2.js', () => ({
	Line2: vi.fn().mockImplementation(function () {
		return {
			geometry: { dispose: vi.fn() },
			material: { dispose: vi.fn() },
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
				props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
			})
		).not.toThrow();
	});

	it('renders a container element', () => {
		const { container } = render(LorenzRenderer, {
			props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
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
				props: { sigma: 15, rho: 35, beta: 1.5, height: 200 }
			})
		).not.toThrow();
	});

	it('renders with different height', () => {
		const { container } = render(LorenzRenderer, {
			props: { sigma: 10, rho: 28, beta: 2.667, height: 400 }
		});
		const wrapper = container.querySelector('div');
		expect(wrapper?.getAttribute('style')).toContain('400px');
	});

	it('displays LIVE_RENDER label', () => {
		const { container } = render(LorenzRenderer, {
			props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
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
					sigma: 10,
					rho: 28,
					beta: 2.667,
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
					sigma: 10,
					rho: 28,
					beta: 2.667,
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
			props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
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
			props: { sigma: 10, rho: 28, beta: 2.667, height: 200 }
		});
		expect(OrbitControls).toHaveBeenCalled();
		expect(Line2).toHaveBeenCalled();
	});
});
