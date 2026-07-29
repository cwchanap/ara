export const PANEL_STORAGE_KEYS = {
	parameters: 'chaos-panel:parameters',
	description: 'chaos-panel:description'
} as const;

export type PanelStorageKey = (typeof PANEL_STORAGE_KEYS)[keyof typeof PANEL_STORAGE_KEYS];

function canUseLocalStorage(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readPanelOpen(key: PanelStorageKey, defaultOpen: boolean): boolean {
	if (!canUseLocalStorage()) return defaultOpen;
	try {
		const raw = window.localStorage.getItem(key);
		if (raw === 'true') return true;
		if (raw === 'false') return false;
		return defaultOpen;
	} catch {
		return defaultOpen;
	}
}

export function writePanelOpen(key: PanelStorageKey, open: boolean): void {
	if (!canUseLocalStorage()) return;
	try {
		window.localStorage.setItem(key, open ? 'true' : 'false');
	} catch {
		// quota / blocked — ignore
	}
}
