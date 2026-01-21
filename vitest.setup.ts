import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (!globalThis.requestAnimationFrame) {
	globalThis.requestAnimationFrame = () => 0;
}

if (!globalThis.cancelAnimationFrame) {
	globalThis.cancelAnimationFrame = () => {};
}

if (!globalThis.ResizeObserver) {
	class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver = ResizeObserver;
}

if (!globalThis.btoa) {
	globalThis.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
}

if (!globalThis.atob) {
	globalThis.atob = (value: string) => Buffer.from(value, 'base64').toString('binary');
}

// Extend Vitest's expect with jest-dom matchers
declare module 'vitest' {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	interface Assertion<T = any> {
		toBeInTheDocument(): T;
		toBeDisabled(): T;
		toBeEnabled(): T;
		toHaveAttribute(attr: string, value?: string): T;
		toHaveClass(...classNames: string[]): T;
		toHaveTextContent(text: string | RegExp): T;
	}
}
