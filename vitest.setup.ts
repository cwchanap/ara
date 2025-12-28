import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

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
