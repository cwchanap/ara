# Collapsible Chaos Control Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make main-viz parameter and description panels, plus compare left/right parameter panels, collapsible with shared `localStorage` preferences and same-page live sync for the parameters key.

**Architecture:** A typed `localStorage` helper feeds a per-key open-state store (seed on first use, write-through on toggle, evict when the last subscriber unsubscribes). `CollapsiblePanel` owns the title-bar toggle, a11y, class-based body hide, and focus restore. Hosts keep their existing card chrome: `ParameterPanel` and `ComparisonParameterPanel` wrap their bodies; `VisualizationShell` collapses only `description.body` and keeps `afterDescription` as a sibling.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript strict, Vitest (node + jsdom), `@testing-library/svelte`, Bun

**Spec:** `docs/superpowers/specs/2026-07-29-collapsible-chaos-panels-design.md`

## Global Constraints

- TypeScript strict mode — no `any` without eslint-disable
- Svelte 5 runes: `$state`, `$effect`, `$props`, snippets
- Package manager: Bun (`bun run …`); PATH may need `export PATH="$HOME/.bun/bin:$PATH"`
- File naming: `*.test.ts` = Vitest node project; `*.svelte.test.ts` = Vitest jsdom project
- Run node tests: `bun run vitest run --project node`
- Run jsdom tests: `bun run vitest run --project jsdom`
- Run full suite: `bun run test`
- Run typecheck: `bun run check`
- Collapse hide mechanism: Tailwind `hidden` class (`display: none`), **not** bare HTML `hidden` attribute alone
- Description: collapse `description.body` only; `afterDescription` stays outside `CollapsiblePanel`
- Compare: required `side: 'left' | 'right'`; `bodyId = chaos-panel-parameters-body-${side}`; children **and** `equations` collapse together
- No cross-tab `storage` listeners; no pre-hydration FOUC script
- Commit messages: `feat:` / `fix:` / `test:` / `docs:` prefixes

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `src/lib/chaos-panel-storage.ts` | `PANEL_STORAGE_KEYS`, `PanelStorageKey`, `readPanelOpen`, `writePanelOpen` |
| `src/lib/chaos-panel-storage.test.ts` | Node unit tests for storage helper |
| `src/lib/chaos-panel-open-store.ts` | Per-key store: subscribe / setOpen / getOpen / eviction / test reset |
| `src/lib/chaos-panel-open-store.test.ts` | Node unit tests for open store |
| `src/lib/components/ui/CollapsiblePanel.svelte` | Title toggle + collapsible body |
| `src/lib/components/ui/CollapsiblePanel.svelte.test.ts` | Jsdom component tests |

### Modified files

| File | Change |
|------|--------|
| `src/lib/components/ui/ParameterPanel.svelte` | Integrate `CollapsiblePanel`; body = children + formula |
| `src/lib/components/ui/ParameterPanel.svelte.test.ts` | Collapse/expand coverage; reset stores in `afterEach` |
| `src/lib/components/ui/VisualizationShell.svelte` | Description `CollapsiblePanel`; `afterDescription` sibling |
| `src/lib/components/ui/VisualizationShell.svelte.test.ts` | Description default collapsed; afterDescription visible |
| `src/lib/components/comparison/ComparisonParameterPanel.svelte` | Required `side`; integrate `CollapsiblePanel` |
| `src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts` | Pass `side`; collapse + two-instance sync |
| `src/routes/{arnold-cat,bakers-map,bifurcation-henon,bifurcation-logistic,chaos-esthetique,chua,clifford,double-pendulum,gingerbreadman,gumowski-mira,henon,ikeda,logistic,lorenz,lozi,lyapunov,newton,rossler,standard,tinkerbell}/compare/+page.svelte` | `side="left"` / `side="right"` |

---

### Task 1: Storage helper

**Files:**

- Create: `src/lib/chaos-panel-storage.ts`
- Create: `src/lib/chaos-panel-storage.test.ts`

**Interfaces:**

- Produces: `PANEL_STORAGE_KEYS`, `PanelStorageKey`, `readPanelOpen(key, defaultOpen)`, `writePanelOpen(key, open)`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chaos-panel-storage.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PANEL_STORAGE_KEYS,
	readPanelOpen,
	writePanelOpen
} from './chaos-panel-storage';

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
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		expect(readPanelOpen(PANEL_STORAGE_KEYS.description, false)).toBe(false);
		expect(() => writePanelOpen(PANEL_STORAGE_KEYS.description, true)).not.toThrow();
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun run vitest run --project node src/lib/chaos-panel-storage.test.ts
```

Expected: FAIL — module not found / cannot resolve `./chaos-panel-storage`.

- [ ] **Step 3: Implement storage helper**

Create `src/lib/chaos-panel-storage.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run --project node src/lib/chaos-panel-storage.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chaos-panel-storage.ts src/lib/chaos-panel-storage.test.ts
git commit -m "feat: add chaos panel localStorage helper"
```

---

### Task 2: Open-state store

**Files:**

- Create: `src/lib/chaos-panel-open-store.ts`
- Create: `src/lib/chaos-panel-open-store.test.ts`

**Interfaces:**

- Consumes: `PanelStorageKey`, `readPanelOpen`, `writePanelOpen` from Task 1
- Produces: `getPanelOpenStore(key, defaultOpen)`, `resetPanelOpenStoresForTests()`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chaos-panel-open-store.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PANEL_STORAGE_KEYS, writePanelOpen } from './chaos-panel-storage';
import { getPanelOpenStore, resetPanelOpenStoresForTests } from './chaos-panel-open-store';

function installMemoryStorage() {
	const map = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
		setItem: (k: string, v: string) => {
			map.set(k, v);
		},
		removeItem: (k: string) => {
			map.delete(k);
		},
		clear: () => map.clear()
	});
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run --project node src/lib/chaos-panel-open-store.test.ts
```

Expected: FAIL — cannot resolve `./chaos-panel-open-store`.

- [ ] **Step 3: Implement open store**

Create `src/lib/chaos-panel-open-store.ts`:

```typescript
import {
	type PanelStorageKey,
	readPanelOpen,
	writePanelOpen
} from './chaos-panel-storage';

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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run --project node src/lib/chaos-panel-open-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chaos-panel-open-store.ts src/lib/chaos-panel-open-store.test.ts
git commit -m "feat: add chaos panel open-state store with eviction"
```

---

### Task 3: CollapsiblePanel component

**Files:**

- Create: `src/lib/components/ui/CollapsiblePanel.svelte`
- Create: `src/lib/components/ui/CollapsiblePanel.svelte.test.ts`

**Interfaces:**

- Consumes: `PanelStorageKey`, `PANEL_STORAGE_KEYS`, `getPanelOpenStore`, `resetPanelOpenStoresForTests`
- Produces: `CollapsiblePanel` props `{ title, storageKey, defaultOpen, bodyId, titleLevel?, children }`

- [ ] **Step 1: Write the failing component tests**

Create `src/lib/components/ui/CollapsiblePanel.svelte.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import CollapsiblePanel from './CollapsiblePanel.svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
import { resetPanelOpenStoresForTests } from '$lib/chaos-panel-open-store';

function installMemoryStorage() {
	const map = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
		setItem: (k: string, v: string) => {
			map.set(k, v);
		},
		removeItem: (k: string) => {
			map.delete(k);
		},
		clear: () => map.clear()
	});
	return map;
}

const body = createRawSnippet(() => ({
	render: () => '<button data-testid="inside-body">Inside</button>'
}));

describe('CollapsiblePanel', () => {
	beforeEach(() => {
		installMemoryStorage();
		resetPanelOpenStoresForTests();
	});

	afterEach(() => {
		cleanup();
		resetPanelOpenStoresForTests();
		vi.unstubAllGlobals();
	});

	it('starts from defaultOpen=true with body visible and aria-expanded true', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i })).toHaveAttribute(
				'aria-expanded',
				'true'
			);
		});
		const region = document.getElementById('chaos-panel-parameters-body');
		expect(region).toBeTruthy();
		expect(region!.classList.contains('hidden')).toBe(false);
		expect(screen.getByTestId('inside-body')).toBeInTheDocument();
	});

	it('starts from defaultOpen=false with body hidden', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'DATA_LOG',
				storageKey: PANEL_STORAGE_KEYS.description,
				defaultOpen: false,
				bodyId: 'chaos-panel-description-body',
				titleLevel: 'h3',
				children: body
			}
		});
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /DATA_LOG/i })).toHaveAttribute(
				'aria-expanded',
				'false'
			);
		});
		const region = document.getElementById('chaos-panel-description-body');
		expect(region!.classList.contains('hidden')).toBe(true);
	});

	it('toggles open state, aria-expanded, hidden class, and localStorage', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const toggle = await screen.findByRole('button', { name: /SYSTEM_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(document.getElementById('chaos-panel-parameters-body')!.classList.contains('hidden')).toBe(
			true
		);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
		await fireEvent.click(toggle);
		expect(toggle).toHaveAttribute('aria-expanded', 'true');
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('true');
	});

	it('wires aria-controls to bodyId', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const toggle = await screen.findByRole('button', { name: /SYSTEM_PARAMETERS/i });
		expect(toggle).toHaveAttribute('aria-controls', 'chaos-panel-parameters-body');
	});

	it('moves focus to the toggle when collapsing while focus is inside the body', async () => {
		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const inside = await screen.findByTestId('inside-body');
		inside.focus();
		expect(document.activeElement).toBe(inside);
		const toggle = screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(document.activeElement).toBe(toggle);
	});

	it('keeps unique body ids and live-syncs two panels on the same storageKey', async () => {
		const { container } = render(CollapsiblePanel, {
			props: {
				title: 'LEFT',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body-left',
				titleLevel: 'h3',
				children: body
			}
		});
		// Second instance in the same document
		const mount = document.createElement('div');
		container.appendChild(mount);
		const { unmount } = render(CollapsiblePanel, {
			target: mount,
			props: {
				title: 'RIGHT',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body-right',
				titleLevel: 'h3',
				children: body
			}
		});

		expect(document.getElementById('chaos-panel-parameters-body-left')).toBeTruthy();
		expect(document.getElementById('chaos-panel-parameters-body-right')).toBeTruthy();
		expect(document.querySelectorAll('#chaos-panel-parameters-body-left').length).toBe(1);
		expect(document.querySelectorAll('#chaos-panel-parameters-body-right').length).toBe(1);

		const leftToggle = screen.getByRole('button', { name: /LEFT/i });
		const rightToggle = screen.getByRole('button', { name: /RIGHT/i });
		await fireEvent.click(leftToggle);
		await waitFor(() => {
			expect(leftToggle).toHaveAttribute('aria-expanded', 'false');
			expect(rightToggle).toHaveAttribute('aria-expanded', 'false');
		});
		unmount();
	});

	it('re-seeds from localStorage after unmount eviction', async () => {
		const first = render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		const toggle = await screen.findByRole('button', { name: /SYSTEM_PARAMETERS/i });
		await fireEvent.click(toggle);
		expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
		first.unmount();
		cleanup();

		// Other-tab style overwrite while unmounted
		localStorage.setItem(PANEL_STORAGE_KEYS.parameters, 'true');
		resetPanelOpenStoresForTests(); // ensure map empty if unmount race; eviction should already clear

		render(CollapsiblePanel, {
			props: {
				title: 'SYSTEM_PARAMETERS',
				storageKey: PANEL_STORAGE_KEYS.parameters,
				defaultOpen: true,
				bodyId: 'chaos-panel-parameters-body',
				children: body
			}
		});
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i })).toHaveAttribute(
				'aria-expanded',
				'true'
			);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run vitest run --project jsdom src/lib/components/ui/CollapsiblePanel.svelte.test.ts
```

Expected: FAIL — cannot resolve `./CollapsiblePanel.svelte`.

- [ ] **Step 3: Implement CollapsiblePanel**

Create `src/lib/components/ui/CollapsiblePanel.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { PanelStorageKey } from '$lib/chaos-panel-storage';
	import { getPanelOpenStore } from '$lib/chaos-panel-open-store';

	interface Props {
		title: string;
		storageKey: PanelStorageKey;
		defaultOpen: boolean;
		bodyId: string;
		titleLevel?: 'h2' | 'h3';
		children: Snippet;
	}

	let {
		title,
		storageKey,
		defaultOpen,
		bodyId,
		titleLevel = 'h2',
		children
	}: Props = $props();

	let open = $state(defaultOpen);
	let toggleEl: HTMLButtonElement | undefined = $state();
	let bodyEl: HTMLDivElement | undefined = $state();

	$effect(() => {
		const store = getPanelOpenStore(storageKey, defaultOpen);
		return store.subscribe((value) => {
			open = value;
		});
	});

	function toggle() {
		const next = !open;
		if (!next && bodyEl && document.activeElement && bodyEl.contains(document.activeElement)) {
			toggleEl?.focus();
		}
		getPanelOpenStore(storageKey, defaultOpen).setOpen(next);
	}
</script>

<div class="space-y-4">
	<button
		bind:this={toggleEl}
		type="button"
		class="w-full text-left flex items-center gap-2 text-primary font-['Orbitron'] font-semibold group/toggle"
		class:text-xl={titleLevel === 'h2'}
		class:text-sm={titleLevel === 'h3'}
		aria-expanded={open}
		aria-controls={bodyId}
		onclick={toggle}
	>
		<span class="inline-block w-2 h-2 bg-primary rounded-full animate-pulse shrink-0" class:w-1.5={titleLevel === 'h3'} class:h-1.5={titleLevel === 'h3'}></span>
		{#if titleLevel === 'h3'}
			<span class="flex-1">{title}</span>
		{:else}
			<span class="flex-1 text-xl font-['Orbitron'] font-semibold">{title}</span>
		{/if}
		<span
			aria-hidden="true"
			class="inline-block transition-transform duration-200 motion-reduce:transition-none {open
				? 'rotate-180'
				: 'rotate-0'}"
			>▾</span
		>
	</button>

	<div id={bodyId} bind:this={bodyEl} class="space-y-6" class:hidden={!open}>
		{@render children()}
	</div>
</div>
```

Notes for the implementer:

- Use Tailwind `hidden` (`class:hidden={!open}`), not the HTML `hidden` attribute.
- `motion-reduce:transition-none` covers `prefers-reduced-motion`.
- Heading levels: keep accessible name via the button text; do **not** nest interactive content inside a separate heading that also wraps the button. The button’s accessible name is the title string.
- Compare uses `titleLevel="h3"` and slightly smaller pulse dot to match prior compare chrome; main params use default `h2` sizing.
- If svelte-check complains about duplicate class directives, merge into a single `class` string per element.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run vitest run --project jsdom src/lib/components/ui/CollapsiblePanel.svelte.test.ts
```

Expected: PASS. If the two-instance `render({ target })` API differs in this Testing Library version, mount both via a tiny harness snippet component instead — still assert distinct ids and live sync.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/CollapsiblePanel.svelte src/lib/components/ui/CollapsiblePanel.svelte.test.ts
git commit -m "feat: add CollapsiblePanel with store sync and a11y"
```

---

### Task 4: Wire ParameterPanel

**Files:**

- Modify: `src/lib/components/ui/ParameterPanel.svelte`
- Modify: `src/lib/components/ui/ParameterPanel.svelte.test.ts`

**Interfaces:**

- Consumes: `CollapsiblePanel`, `PANEL_STORAGE_KEYS`
- Produces: Parameter panel with collapsible body (children + formula); outer chrome unchanged

- [ ] **Step 1: Extend ParameterPanel tests (failing collapse case)**

In `src/lib/components/ui/ParameterPanel.svelte.test.ts`, add imports and `afterEach` reset:

```typescript
import { fireEvent } from '@testing-library/svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
import { resetPanelOpenStoresForTests } from '$lib/chaos-panel-open-store';
```

In both `describe` blocks’ `afterEach`, call `resetPanelOpenStoresForTests()` after `cleanup()`, and clear `localStorage` if present (`localStorage.clear()`).

Add:

```typescript
it('collapses children and formula behind the title toggle', async () => {
	render(ParameterPanel, {
		props: { children: childSnippet, formula: ['x = f(y)'] }
	});
	expect(screen.getByTestId('param-child')).toBeVisible();
	expect(screen.getByText('x = f(y)')).toBeVisible();
	const toggle = screen.getByRole('button', { name: /SYSTEM_PARAMETERS/i });
	expect(toggle).toHaveAttribute('aria-controls', 'chaos-panel-parameters-body');
	await fireEvent.click(toggle);
	expect(document.getElementById('chaos-panel-parameters-body')!.classList.contains('hidden')).toBe(
		true
	);
	expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
});
```

- [ ] **Step 2: Run the new test — expect fail**

```bash
bun run vitest run --project jsdom src/lib/components/ui/ParameterPanel.svelte.test.ts
```

Expected: FAIL — no toggle button / no `chaos-panel-parameters-body`.

- [ ] **Step 3: Integrate CollapsiblePanel into ParameterPanel**

Replace the inner title + body of `src/lib/components/ui/ParameterPanel.svelte` so the outer chrome stays, and the heading/sliders/formula move under `CollapsiblePanel`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';
	import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';

	interface Props {
		title?: string;
		children: Snippet;
		formula?: string[];
		paramColumns?: 1 | 2 | 3 | 4 | 5;
		equationColumns?: 1 | 2 | 3 | 4 | 5;
	}

	let {
		title = 'SYSTEM_PARAMETERS',
		children,
		formula,
		paramColumns = 3,
		equationColumns = 3
	}: Props = $props();

	const COLS: Record<1 | 2 | 3 | 4 | 5, string> = {
		1: 'md:grid-cols-1',
		2: 'md:grid-cols-2',
		3: 'md:grid-cols-3',
		4: 'md:grid-cols-4',
		5: 'md:grid-cols-5'
	};
</script>

<div
	class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 space-y-6 relative overflow-hidden group"
>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

	<CollapsiblePanel
		{title}
		storageKey={PANEL_STORAGE_KEYS.parameters}
		defaultOpen={true}
		bodyId="chaos-panel-parameters-body"
		titleLevel="h2"
	>
		<div class="grid grid-cols-1 {COLS[paramColumns]} gap-8">
			{@render children()}
		</div>

		{#if formula && formula.length > 0}
			<div
				class="grid grid-cols-1 {COLS[
					equationColumns
				]} gap-4 text-xs text-muted-foreground font-mono bg-black/20 p-4 rounded border border-white/5"
			>
				{#each formula as line, i (i)}
					<p>{line}</p>
				{/each}
			</div>
		{/if}
	</CollapsiblePanel>
</div>
```

- [ ] **Step 4: Run ParameterPanel tests**

```bash
bun run vitest run --project jsdom src/lib/components/ui/ParameterPanel.svelte.test.ts
```

Expected: PASS (including existing title/columns tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/ParameterPanel.svelte src/lib/components/ui/ParameterPanel.svelte.test.ts
git commit -m "feat: make ParameterPanel collapsible"
```

---

### Task 5: Wire VisualizationShell description + afterDescription

**Files:**

- Modify: `src/lib/components/ui/VisualizationShell.svelte` (description block near the bottom)
- Modify: `src/lib/components/ui/VisualizationShell.svelte.test.ts`

**Interfaces:**

- Consumes: `CollapsiblePanel`, `PANEL_STORAGE_KEYS`
- Produces: description heading as toggle; body = `description.body` only; `afterDescription` sibling outside collapse

- [ ] **Step 1: Add failing shell tests**

In `VisualizationShell.svelte.test.ts`, import `resetPanelOpenStoresForTests` and call it in `afterEach` alongside `cleanup()`. Clear `localStorage` too.

Add:

```typescript
it('starts with description body collapsed and afterDescription still visible', async () => {
	const afterDescription = createRawSnippet(() => ({
		render: () => '<div data-testid="after-desc">λₘₐₓ live</div>'
	}));
	render(VisualizationShell, {
		props: {
			mapType: 'henon',
			title: 'HÉNON_MAP',
			moduleNumber: '02',
			paramDefs: defs,
			buildParameters: (v: Record<string, number>) => ({
				type: 'henon',
				a: v.a,
				b: 0.3,
				iterations: 2000
			}),
			formula: ['x(n+1) = …'],
			description: { heading: 'DATA_LOG: HÉNON_MAP', body: 'desc body copy' },
			isAuthenticated: true,
			renderer,
			afterDescription,
			...authedPageProps
		} as never
	});

	await waitFor(() => {
		const toggle = screen.getByRole('button', { name: /DATA_LOG: HÉNON_MAP/i });
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
		expect(toggle).toHaveAttribute('aria-controls', 'chaos-panel-description-body');
	});
	expect(document.getElementById('chaos-panel-description-body')!.classList.contains('hidden')).toBe(
		true
	);
	expect(screen.getByTestId('after-desc')).toBeVisible();
	expect(screen.getByTestId('after-desc')).toHaveTextContent('λₘₐₓ live');

	await fireEvent.click(screen.getByRole('button', { name: /DATA_LOG: HÉNON_MAP/i }));
	expect(document.getElementById('chaos-panel-description-body')!.classList.contains('hidden')).toBe(
		false
	);
	expect(screen.getByText('desc body copy')).toBeVisible();
});
```

Update the existing `renders the afterDescription slot inside the description panel` test if it assumed description body visibility — afterDescription must remain findable; do not require description body text to be visible.

- [ ] **Step 2: Run shell tests — expect the new test to fail**

```bash
bun run vitest run --project jsdom src/lib/components/ui/VisualizationShell.svelte.test.ts
```

Expected: FAIL on the new collapsed-description assertion.

- [ ] **Step 3: Replace the description block in VisualizationShell**

Near the bottom of `VisualizationShell.svelte`, replace:

```svelte
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<h3 class="text-lg font-['Orbitron'] font-semibold text-primary mb-2">{description.heading}</h3>
		<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">{description.body}</p>
		{#if afterDescription}{@render afterDescription()}{/if}
	</div>
```

with:

```svelte
	<div class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-6 relative">
		<div
			class="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-primary to-transparent opacity-50"
		></div>
		<CollapsiblePanel
			title={description.heading}
			storageKey={PANEL_STORAGE_KEYS.description}
			defaultOpen={false}
			bodyId="chaos-panel-description-body"
			titleLevel="h3"
		>
			<p class="text-muted-foreground text-sm leading-relaxed max-w-3xl">{description.body}</p>
		</CollapsiblePanel>
		{#if afterDescription}{@render afterDescription()}{/if}
	</div>
```

Add imports at the top of the script:

```typescript
import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
```

- [ ] **Step 4: Run shell tests**

```bash
bun run vitest run --project jsdom src/lib/components/ui/VisualizationShell.svelte.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ui/VisualizationShell.svelte src/lib/components/ui/VisualizationShell.svelte.test.ts
git commit -m "feat: collapsible description panel; keep afterDescription visible"
```

---

### Task 6: Wire ComparisonParameterPanel

**Files:**

- Modify: `src/lib/components/comparison/ComparisonParameterPanel.svelte`
- Modify: `src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts`

**Interfaces:**

- Consumes: `CollapsiblePanel`, `PANEL_STORAGE_KEYS`
- Produces: required `side: 'left' | 'right'`; `bodyId = chaos-panel-parameters-body-${side}`; body = children + equations

- [ ] **Step 1: Update tests for required `side` + collapse + sync**

Replace/extend `ComparisonParameterPanel.svelte.test.ts` so **every** render passes `side: 'left'` (or `'right'`). Add:

```typescript
import { fireEvent, waitFor } from '@testing-library/svelte';
import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';
import { resetPanelOpenStoresForTests } from '$lib/chaos-panel-open-store';

beforeEach(() => {
	resetPanelOpenStoresForTests();
	localStorage.clear();
});

afterEach(() => {
	cleanup();
	resetPanelOpenStoresForTests();
});

it('requires side-derived body id and collapses children + equations', async () => {
	render(ComparisonParameterPanel, {
		props: {
			side: 'left',
			title: 'LEFT_PARAMETERS',
			children: childSnippet,
			equations: equationsSnippet
		}
	});
	expect(document.getElementById('chaos-panel-parameters-body-left')).toBeTruthy();
	expect(screen.getByTestId('child-content')).toBeVisible();
	expect(screen.getByTestId('equations-content')).toBeVisible();
	const toggle = screen.getByRole('button', { name: /LEFT_PARAMETERS/i });
	await fireEvent.click(toggle);
	expect(
		document.getElementById('chaos-panel-parameters-body-left')!.classList.contains('hidden')
	).toBe(true);
	expect(localStorage.getItem(PANEL_STORAGE_KEYS.parameters)).toBe('false');
});

it('live-syncs left and right panels on the parameters key', async () => {
	const { container } = render(ComparisonParameterPanel, {
		props: { side: 'left', title: 'LEFT_PARAMETERS', children: childSnippet }
	});
	const mount = document.createElement('div');
	container.appendChild(mount);
	render(ComparisonParameterPanel, {
		target: mount,
		props: { side: 'right', title: 'RIGHT_PARAMETERS', children: childSnippet }
	});
	expect(document.getElementById('chaos-panel-parameters-body-left')).toBeTruthy();
	expect(document.getElementById('chaos-panel-parameters-body-right')).toBeTruthy();
	await fireEvent.click(screen.getByRole('button', { name: /LEFT_PARAMETERS/i }));
	await waitFor(() => {
		expect(screen.getByRole('button', { name: /LEFT_PARAMETERS/i })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		expect(screen.getByRole('button', { name: /RIGHT_PARAMETERS/i })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	});
});
```

Update existing tests’ props to include `side: 'left'`.

- [ ] **Step 2: Run compare panel tests — expect fail**

```bash
bun run vitest run --project jsdom src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts
```

Expected: FAIL — missing `side` / no collapse wiring.

- [ ] **Step 3: Implement ComparisonParameterPanel integration**

Rewrite `src/lib/components/comparison/ComparisonParameterPanel.svelte`:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CollapsiblePanel from '$lib/components/ui/CollapsiblePanel.svelte';
	import { PANEL_STORAGE_KEYS } from '$lib/chaos-panel-storage';

	interface Props {
		title?: string;
		side: 'left' | 'right';
		children: Snippet;
		equations?: Snippet;
	}

	let { title = 'PARAMETERS', side, children, equations }: Props = $props();

	const bodyId = $derived(`chaos-panel-parameters-body-${side}`);
</script>

<div
	class="bg-card/30 backdrop-blur-md border border-primary/20 rounded-sm p-4 space-y-4 relative overflow-hidden"
>
	<div class="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary"></div>
	<div class="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary"></div>
	<div class="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary"></div>
	<div class="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary"></div>

	<CollapsiblePanel
		{title}
		storageKey={PANEL_STORAGE_KEYS.parameters}
		defaultOpen={true}
		{bodyId}
		titleLevel="h3"
	>
		<div class="grid grid-cols-1 gap-4">
			{@render children()}
		</div>

		{#if equations}
			<div
				class="text-xs text-muted-foreground font-mono bg-black/20 p-3 rounded border border-white/5 space-y-1"
			>
				{@render equations()}
			</div>
		{/if}
	</CollapsiblePanel>
</div>
```

- [ ] **Step 4: Run compare panel tests**

```bash
bun run vitest run --project jsdom src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/comparison/ComparisonParameterPanel.svelte src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts
git commit -m "feat: make ComparisonParameterPanel collapsible with side bodyIds"
```

---

### Task 7: Add `side` to all 20 compare pages

**Files:**

- Modify each `src/routes/<map>/compare/+page.svelte` listed in File Structure (20 files)

**Interfaces:**

- Consumes: required `side` on `ComparisonParameterPanel`
- Produces: valid compare pages that typecheck

- [ ] **Step 1: Confirm current call sites**

```bash
rg -n 'ComparisonParameterPanel' src/routes --glob '**/compare/+page.svelte'
```

Expected: each file has a LEFT and RIGHT panel (titles like `LEFT_PARAMETERS` / `RIGHT_PARAMETERS`).

- [ ] **Step 2: Add `side` props**

For each of the 20 compare pages, change:

```svelte
<ComparisonParameterPanel title="LEFT_PARAMETERS">
```

to:

```svelte
<ComparisonParameterPanel side="left" title="LEFT_PARAMETERS">
```

and:

```svelte
<ComparisonParameterPanel title="RIGHT_PARAMETERS">
```

to:

```svelte
<ComparisonParameterPanel side="right" title="RIGHT_PARAMETERS">
```

Use the actual title strings present in each file (some may differ slightly — match the existing title, only insert `side`).

Mechanical approach:

```bash
# Review diffs carefully; titles vary. Prefer explicit edits per file if titles differ.
rg -n '<ComparisonParameterPanel' src/routes --glob '**/compare/+page.svelte'
```

Edit each file so the first `ComparisonParameterPanel` in the left column gets `side="left"` and the right column gets `side="right"`.

- [ ] **Step 3: Typecheck**

```bash
bun run check
```

Expected: no errors about missing `side` on `ComparisonParameterPanel`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/*/compare/+page.svelte
git commit -m "feat: pass compare panel side for unique collapsible body ids"
```

---

### Task 8: Full regression

**Files:** none new — verify suite

- [ ] **Step 1: Run full Vitest suite**

```bash
bun run test
```

Expected: PASS. If any page/shell test asserted description body text was visible without expanding, update that test to expand first or assert the toggle instead.

- [ ] **Step 2: Run lint + check**

```bash
bun run check
bun run lint
```

Expected: clean (or only pre-existing unrelated issues). Fix anything introduced by this work.

- [ ] **Step 3: Commit any test fixes**

```bash
git add -A
git status
# If there are fixes:
git commit -m "test: fix regressions for collapsible panels"
```

If working tree clean, skip the commit.

---

## Plan Self-Review

| Spec requirement | Task |
|------------------|------|
| `chaos-panel-storage` + typed keys + SSR/throw safety | Task 1 |
| Open store + live sync + eviction + test reset | Task 2 |
| `CollapsiblePanel` a11y, class hide, focus, reduced motion, bodyId | Task 3 |
| `ParameterPanel` integration | Task 4 |
| Shell description collapse; `afterDescription` outside | Task 5 |
| `ComparisonParameterPanel` + `side` + equations in body | Task 6 |
| 20 compare pages `side` props | Task 7 |
| Full suite regression | Task 8 |
| No E2E / no FOUC script / no storage listeners | Honored in Global Constraints + Non-Goals |

**Placeholder scan:** none intentional.  
**Type consistency:** `PanelStorageKey` / `PANEL_STORAGE_KEYS` / `getPanelOpenStore` / `resetPanelOpenStoresForTests` / `bodyId` / `side` names match across tasks.
