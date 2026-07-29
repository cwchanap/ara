import { type PanelStorageKey, readPanelOpen, writePanelOpen } from './chaos-panel-storage';

interface PanelOpenStore {
	subscribe: (fn: (open: boolean) => void) => () => void;
	setOpen: (open: boolean) => void;
	getOpen: () => boolean;
}

interface Entry {
	open: boolean;
	subscribers: Set<(open: boolean) => void>;
	api: PanelOpenStore;
}

const entries = new Map<PanelStorageKey, Entry>();

export function getPanelOpenStore(key: PanelStorageKey, defaultOpen: boolean): PanelOpenStore {
	const existing = entries.get(key);
	if (existing) return existing.api;

	const entry: Entry = {
		open: readPanelOpen(key, defaultOpen),
		subscribers: new Set(),
		api: null as unknown as PanelOpenStore
	};

	entry.api = {
		getOpen: () => entry.open,
		setOpen: (open: boolean) => {
			entry.open = open;
			writePanelOpen(key, open);
			for (const fn of entry.subscribers) fn(open);
		},
		subscribe: (fn) => {
			entry.subscribers.add(fn);
			fn(entry.open);
			return () => {
				entry.subscribers.delete(fn);
				if (entry.subscribers.size === 0) {
					entries.delete(key);
				}
			};
		}
	};

	entries.set(key, entry);
	return entry.api;
}

export function resetPanelOpenStoresForTests(): void {
	entries.clear();
}
