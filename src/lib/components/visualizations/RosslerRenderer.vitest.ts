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
		return { geometry: {}, material: {} };
	}),
	GridHelper: vi.fn().mockImplementation(function () {
		return { material: { transparent: false, opacity: 1 }, position: { y: 0 } };
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

describe('RosslerRenderer (smoke)', () => {
	afterEach(() => {
		cleanup();
	});

	it('renders without throwing', () => {
		expect(() =>
			render(RosslerRenderer, {
				props: { a: 0.2, b: 0.2, c: 5.7, height: 200 }
			})
		).not.toThrow();
	});

	it('renders a container element', () => {
		const { container } = render(RosslerRenderer, {
			props: { a: 0.2, b: 0.2, c: 5.7, height: 200 }
		});
		expect(container.querySelector('div')).not.toBeNull();
	});
});
