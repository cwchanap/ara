import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANEL_STORAGE_KEYS, readPanelOpen, writePanelOpen } from './chaos-panel-storage';

function installMemoryStorage() {
	const map = new Map<string, string>();
	const storage = {
		getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
		setItem: (k: string, v: string) => {
			map.set(k, v);
		},
		removeItem: (k: string) => {
			map.delete(k);
		},
		clear: () => map.clear(),
		get length() {
			return map.size;
		},
		key: () => null
	};
	vi.stubGlobal('localStorage', storage);
	vi.stubGlobal('window', { localStorage: storage });
	return map;
}

describe('chaos-panel-storage', () => {
	beforeEach(() => {
		installMemoryStorage();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('exports the two canonical keys', () => {
		expect(PANEL_STORAGE_KEYS.parameters).toBe('chaos-panel:parameters');
		expect(PANEL_STORAGE_KEYS.description).toBe('chaos-panel:description');
	});

	it('returns defaultOpen when nothing is stored', () => {
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, true)).toBe(true);
		expect(readPanelOpen(PANEL_STORAGE_KEYS.description, false)).toBe(false);
	});

	it('round-trips true and false', () => {
		writePanelOpen(PANEL_STORAGE_KEYS.parameters, false);
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, true)).toBe(false);
		writePanelOpen(PANEL_STORAGE_KEYS.parameters, true);
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, false)).toBe(true);
	});

	it('treats corrupt values as missing and returns defaultOpen', () => {
		localStorage.setItem(PANEL_STORAGE_KEYS.parameters, 'maybe');
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, true)).toBe(true);
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, false)).toBe(false);
	});

	it('returns defaultOpen when localStorage.getItem throws', () => {
		const throwingStorage = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		vi.stubGlobal('window', { localStorage: throwingStorage });
		expect(readPanelOpen(PANEL_STORAGE_KEYS.description, false)).toBe(false);
		expect(() => writePanelOpen(PANEL_STORAGE_KEYS.description, true)).not.toThrow();
	});

	it('returns defaultOpen when accessing window.localStorage throws', () => {
		vi.stubGlobal('window', {
			get localStorage(): Storage {
				throw new Error('SecurityError');
			}
		});
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, true)).toBe(true);
		expect(readPanelOpen(PANEL_STORAGE_KEYS.description, false)).toBe(false);
		expect(() => writePanelOpen(PANEL_STORAGE_KEYS.parameters, false)).not.toThrow();
	});

	it('returns defaultOpen when window.localStorage is undefined', () => {
		vi.stubGlobal('window', {});
		expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, true)).toBe(true);
		expect(readPanelOpen(PANEL_STORAGE_KEYS.description, false)).toBe(false);
		expect(() => writePanelOpen(PANEL_STORAGE_KEYS.parameters, false)).not.toThrow();
	});

	it('returns defaultOpen when window is undefined (SSR path)', () => {
		const original = globalThis.window;
		// @ts-expect-error intentional SSR simulation
		delete globalThis.window;
		try {
			expect(readPanelOpen(PANEL_STORAGE_KEYS.parameters, true)).toBe(true);
			expect(() => writePanelOpen(PANEL_STORAGE_KEYS.parameters, false)).not.toThrow();
		} finally {
			globalThis.window = original;
		}
	});
});
