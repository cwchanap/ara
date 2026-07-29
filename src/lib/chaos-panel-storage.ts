export const PANEL_STORAGE_KEYS = {
	parameters: 'chaos-panel:parameters',
	description: 'chaos-panel:description'
} as const;

export type PanelStorageKey = (typeof PANEL_STORAGE_KEYS)[keyof typeof PANEL_STORAGE_KEYS];

export function readPanelOpen(key: PanelStorageKey, defaultOpen: boolean): boolean {
	if (typeof window === 'undefined') return defaultOpen;
	try {
		const storage = window.localStorage;
		if (typeof storage === 'undefined') return defaultOpen;
		const raw = storage.getItem(key);
		if (raw === 'true') return true;
		if (raw === 'false') return false;
		return defaultOpen;
	} catch {
		return defaultOpen;
	}
}

export function writePanelOpen(key: PanelStorageKey, open: boolean): void {
	if (typeof window === 'undefined') return;
	try {
		const storage = window.localStorage;
		if (typeof storage === 'undefined') return;
		storage.setItem(key, open ? 'true' : 'false');
	} catch {
		// quota / blocked / SecurityError on getter — ignore
	}
}
