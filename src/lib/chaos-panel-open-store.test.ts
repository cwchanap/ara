import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANEL_STORAGE_KEYS, writePanelOpen } from './chaos-panel-storage';
import { getPanelOpenStore, resetPanelOpenStoresForTests } from './chaos-panel-open-store';

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
		clear: () => map.clear()
	};
	vi.stubGlobal('localStorage', storage);
	vi.stubGlobal('window', { localStorage: storage });
}

describe('chaos-panel-open-store', () => {
	beforeEach(() => {
		installMemoryStorage();
		resetPanelOpenStoresForTests();
	});

	afterEach(() => {
		resetPanelOpenStoresForTests();
		vi.unstubAllGlobals();
	});

	it('seeds from localStorage on first get', () => {
		writePanelOpen(PANEL_STORAGE_KEYS.parameters, false);
		const store = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		expect(store.getOpen()).toBe(false);
	});

	it('uses defaultOpen when nothing stored', () => {
		const store = getPanelOpenStore(PANEL_STORAGE_KEYS.description, false);
		expect(store.getOpen()).toBe(false);
	});

	it('notifies multiple subscribers and write-throughs storage', () => {
		const store = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		const a: boolean[] = [];
		const b: boolean[] = [];
		const unsubA = store.subscribe((v) => a.push(v));
		const unsubB = store.subscribe((v) => b.push(v));
		expect(a).toEqual([true]);
		expect(b).toEqual([true]);
		store.setOpen(false);
		expect(a).toEqual([true, false]);
		expect(b).toEqual([true, false]);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
		unsubA();
		unsubB();
	});

	it('ignores defaultOpen when an entry already exists', () => {
		const first = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		first.setOpen(false);
		const second = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		expect(second.getOpen()).toBe(false);
		expect(second).toBe(first);
	});

	it('keeps independent keys from cross-talking', () => {
		const params = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		const desc = getPanelOpenStore(PANEL_STORAGE_KEYS.description, false);
		params.setOpen(false);
		expect(desc.getOpen()).toBe(false);
		desc.setOpen(true);
		expect(params.getOpen()).toBe(false);
	});

	it('evicts on last unsubscribe and re-seeds from localStorage', () => {
		const store = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		const unsub = store.subscribe(() => {});
		store.setOpen(false);
		unsub();
		// Simulate other-tab write while unmounted
		writePanelOpen(PANEL_STORAGE_KEYS.parameters, true);
		const again = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		expect(again.getOpen()).toBe(true);
		expect(again).not.toBe(store);
	});

	it('resetPanelOpenStoresForTests clears the module map', () => {
		const store = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		store.setOpen(false);
		resetPanelOpenStoresForTests();
		writePanelOpen(PANEL_STORAGE_KEYS.parameters, true);
		const again = getPanelOpenStore(PANEL_STORAGE_KEYS.parameters, true);
		expect(again.getOpen()).toBe(true);
	});
});
