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
		const self = { copy: vi.fn(), lerp: vi.fn(), r: 0, g: 0, b: 0 };
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
