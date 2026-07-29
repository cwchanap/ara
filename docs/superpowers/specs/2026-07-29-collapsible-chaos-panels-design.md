# Collapsible Chaos Module Control Panels

**Date:** 2026-07-29  
**Status:** Approved (design)  
**Scope:** Make main-viz parameter and description panels, plus compare left/right parameter panels, collapsible with shared `localStorage` preferences and same-page live sync for the parameters key.

## Summary

Chaos visualization pages stack chrome above and below the canvas: a `SYSTEM_PARAMETERS` panel (sliders + formula) and a description panel. Compare routes duplicate parameter chrome in left/right `ComparisonParameterPanel`s. None of these collapse today, so the canvas competes with always-open controls.

This design adds a shared `CollapsiblePanel` wrapper, a tiny storage helper, and a module-level open-state store so users can collapse panels to a title-bar toggle. Preferences persist in `localStorage` under two shared keys (not per map). Same-page subscribers sharing a key stay live-synced (so compare left/right never desync). Defaults favor interaction first: parameters open, description closed.

### Design decisions (from brainstorming + review)

| Decision | Choice |
|----------|--------|
| Scope | Main params + description; compare left/right panels |
| Default state | Parameters expanded; description collapsed |
| Persistence | `localStorage`, shared keys (not per-map) |
| Collapsed chrome | Title bar + chevron only |
| Architecture | Shared `CollapsiblePanel` wrapper + storage helper + per-key open-state store |
| Compare sync | Same storage key for left/right; **live same-page sync** via shared store |
| Body when collapsed | Class-based hide (`hidden` / `display: none`); nodes stay in the DOM |
| Body `id` | Host-supplied `bodyId` (deterministic; unique on compare) |
| SSR flash | Accept chrome-only hydrate flash; no pre-hydration inline script in v1 |
| Motion | Chevron transition respects `prefers-reduced-motion` |

## Goals

- One collapse behavior for all main chaos modules via `VisualizationShell` / `ParameterPanel`.
- Description panel on main viz pages is collapsible with the same pattern.
- Compare left/right parameter panels are collapsible, share the parameters preference key, and stay live-synced on the same page.
- Persist open/closed across visits without per-map keys.
- Preserve existing sci-fi styling; no math/renderer changes.
- Valid a11y: unique body ids, `aria-*`, focus restore on collapse.

## Non-Goals

- Per-map or per-route storage keys.
- Compact summary strips, floating fabs, or drawer/sidebar layouts.
- Cross-tab live sync (`storage` event listeners). Independent tabs re-read on navigate/refresh only.
- Collapsing alerts, header actions, or the visualization canvas chrome.
- Visual redesign beyond title-bar toggle + chevron.
- Pre-hydration inline script / FOUC suppression for stored preferences.
- New Playwright E2E suite (unless an existing e2e breaks and needs a small fix).

## Architecture

```
chaos-panel-storage.ts     read/write localStorage (typed keys)
chaos-panel-open-store.ts  per-key open boolean; init from storage; notify subscribers

VisualizationShell
├── ParameterPanel ──► CollapsiblePanel
│                      key: parameters, defaultOpen: true
│                      bodyId: chaos-panel-parameters-body
│                      └── sliders + formula
├── renderer (unchanged)
└── description ──► CollapsiblePanel
                    key: description, defaultOpen: false
                    bodyId: chaos-panel-description-body

ComparisonParameterPanel ──► CollapsiblePanel
                             key: parameters, defaultOpen: true
                             bodyId: chaos-panel-parameters-body-left | …-right
```

### New pieces

| File | Purpose |
|------|---------|
| `src/lib/chaos-panel-storage.ts` | Typed keys + read/write; SSR-safe; never throw |
| `src/lib/chaos-panel-storage.test.ts` | Defaults, corrupt values, write failures, SSR path |
| `src/lib/chaos-panel-open-store.ts` | Per-key open state: seed from storage, `subscribe` / `setOpen`, write-through to storage |
| `src/lib/chaos-panel-open-store.test.ts` | Seed, write-through, multi-subscriber sync |
| `src/lib/components/ui/CollapsiblePanel.svelte` | Title-bar toggle, body show/hide, store wiring, a11y |
| `src/lib/components/ui/CollapsiblePanel.svelte.test.ts` | Toggle, a11y, defaults, storage, focus, two-instance ids, live sync |

### Modified files

| File | Change |
|------|--------|
| `src/lib/components/ui/ParameterPanel.svelte` | Integrate `CollapsiblePanel`; pass `bodyId`; heading becomes toggle; body = children + formula |
| `src/lib/components/ui/ParameterPanel.svelte.test.ts` | Default expanded; toggle collapses body via class hide |
| `src/lib/components/ui/VisualizationShell.svelte` | Wrap description in `CollapsiblePanel` with description key + `bodyId` |
| `src/lib/components/ui/VisualizationShell.svelte.test.ts` | Description default collapsed; expand reveals copy |
| `src/lib/components/comparison/ComparisonParameterPanel.svelte` | Integrate `CollapsiblePanel`; accept/pass side-specific `bodyId` |
| `src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts` | Default expanded; collapse; parameters key; distinct ids when two mounted |

Compare routes that render two `ComparisonParameterPanel`s must pass distinct `bodyId`s (e.g. `…-left` / `…-right`). Prefer a small prop on `ComparisonParameterPanel` (`side: 'left' \| 'right'` or `bodyId`) so each compare page sets it once. If `bodyId` is derived inside the comparison panel from `side`, compare pages only need a `side` prop — minimize per-route churn.

All main viz routes inherit via the shell. No per-route main-page edits required unless a test asserted description visibility without expanding first.

## Component API

### Ownership split

- **Host keeps chrome:** `ParameterPanel`, the shell description `<div>`, and `ComparisonParameterPanel` retain their existing outer card markup (corners, accent bar, padding, borders). Collapse does not restyle those shells.
- **`CollapsiblePanel` owns behavior:** title-row toggle (heading + chevron + button/`aria-*`) and show/hide of the body snippet. Hosts pass title, `bodyId`, and put today’s body in `children`.

### Storage key type

```ts
export const PANEL_STORAGE_KEYS = {
	parameters: 'chaos-panel:parameters',
	description: 'chaos-panel:description'
} as const;

export type PanelStorageKey = (typeof PANEL_STORAGE_KEYS)[keyof typeof PANEL_STORAGE_KEYS];

export function readPanelOpen(key: PanelStorageKey, defaultOpen: boolean): boolean;
export function writePanelOpen(key: PanelStorageKey, open: boolean): void;
```

`CollapsiblePanel`’s `storageKey` prop uses `PanelStorageKey` (same type as the helper). Do not duplicate a separate string-literal union that can drift from `PANEL_STORAGE_KEYS`.

### Open-state store

```ts
/** One shared open boolean per PanelStorageKey for the lifetime of the JS realm. */
export function getPanelOpenStore(key: PanelStorageKey, defaultOpen: boolean): {
	subscribe: (fn: (open: boolean) => void) => () => void;
	setOpen: (open: boolean) => void;
	getOpen: () => boolean;
};
```

- First `getPanelOpenStore(key, defaultOpen)` for a key seeds from `readPanelOpen(key, defaultOpen)`.
- `setOpen` updates in-memory state, notifies all subscribers, and calls `writePanelOpen`.
- Two `CollapsiblePanel`s with the same `storageKey` (compare left/right) therefore stay live-synced.
- Different keys (parameters vs description) are independent stores.
- No `storage` event listeners (cross-tab remains navigate/refresh only).

### `CollapsiblePanel`

```ts
interface Props {
	title: string;
	storageKey: PanelStorageKey;
	defaultOpen: boolean;
	/** Required. Must be unique among CollapsiblePanels on the page. */
	bodyId: string;
	titleLevel?: 'h2' | 'h3'; // default 'h2'; main params h2; compare/description h3
	children: Snippet;
}
```

**Canonical `bodyId` values**

| Surface | `bodyId` |
|---------|----------|
| Main `ParameterPanel` | `chaos-panel-parameters-body` |
| Main description | `chaos-panel-description-body` |
| Compare left | `chaos-panel-parameters-body-left` |
| Compare right | `chaos-panel-parameters-body-right` |

**Behavior**

- Subscribe to `getPanelOpenStore(storageKey, defaultOpen)` for open state (SSR / first paint: use `defaultOpen` until the store is read in the browser; see Errors & SSR).
- Toggle button flips via `setOpen(!open)` (store write-through handles `localStorage`).
- Collapsed: title bar + chevron only. Body element keeps `id={bodyId}` and stays in the DOM, but is visually and interactively hidden via a dedicated class (e.g. Tailwind `hidden` → `display: none`), **not** the bare HTML `hidden` attribute alone. Reason: body content uses `grid`/`flex` utilities; those can override the UA stylesheet for `[hidden]`. Class-based `display: none` wins without `!important` wars.
- Expanded: existing body layout unchanged.
- Host outer card stays visible whether open or closed.
- Chevron rotates to indicate state; transition is disabled (instant) when `prefers-reduced-motion: reduce`.
- No cross-tab live sync.

### Defaults

| Surface | `storageKey` | `defaultOpen` | `bodyId` |
|---------|--------------|---------------|----------|
| Main `ParameterPanel` | `PANEL_STORAGE_KEYS.parameters` | `true` | `chaos-panel-parameters-body` |
| Main description | `PANEL_STORAGE_KEYS.description` | `false` | `chaos-panel-description-body` |
| Compare left | `PANEL_STORAGE_KEYS.parameters` | `true` | `chaos-panel-parameters-body-left` |
| Compare right | `PANEL_STORAGE_KEYS.parameters` | `true` | `chaos-panel-parameters-body-right` |

### Compare sync (resolved)

Left and right share `PANEL_STORAGE_KEYS.parameters` and the same open-state store. Toggling either updates both immediately and writes `localStorage`. This replaces the earlier “no same-page sync” draft; independent `$state` per panel is rejected because shared key + no sync produces mid-session desync and a surprising refresh.

## Interaction & a11y

- Toggle is a real `<button type="button">` associated with the title (not the whole card as a click target).
- `aria-expanded` reflects open state.
- `aria-controls` points at `bodyId`.
- Body region has `id={bodyId}`.
- When collapsed, body is not in the tab order (class-based hide).
- **Focus management:** on collapse, if `document.activeElement` is inside the body region, move focus to the toggle button before/as the body hides.
- Title typography stays Orbitron + pulse-dot treatment consistent with current panels; description uses its existing heading text as the toggle label.

## Errors & SSR

- Storage failures never surface as UI errors or break rendering.
- Server / no `window`: `readPanelOpen` returns `defaultOpen`; writes no-op.
- Corrupt stored values: treat as missing → `defaultOpen`; next successful `setOpen` overwrites with `"true"` / `"false"`.
- **Hydration flash (accepted for v1):** first paint uses `defaultOpen` for deterministic SSR. Client then applies the stored preference via the open store.
  - Description default-closed → stored open: content appears after hydrate (mild).
  - Parameters default-open → stored collapsed: content disappears after hydrate (more jarring; possible layout shift of canvas below). Explicitly accepted as chrome-only; **no** pre-hydration `<html>` class script in v1.

## Testing

1. **`chaos-panel-storage.test.ts`** — defaults; valid true/false; corrupt input; missing/`localStorage` throw; SSR / no-`window` path returns `defaultOpen`.
2. **`chaos-panel-open-store.test.ts`** — seeds from storage; `setOpen` notifies multiple subscribers; write-through to storage; independent keys do not cross-talk.
3. **`CollapsiblePanel.svelte.test.ts`**
   - Starts from `defaultOpen`; toggle updates `aria-expanded` and hides/shows body via class (not visible when collapsed).
   - Persist via mocked storage / store.
   - Focus: with focus inside body, collapse moves focus to toggle.
   - Two instances same `storageKey`, distinct `bodyId`s: ids unique; each `aria-controls` matches its body; toggling one updates both open states (live sync).
   - Optional: render with no `window` / SSR-safe path asserts `defaultOpen` markup.
4. **`ParameterPanel` tests** — default expanded; collapse hides body.
5. **`VisualizationShell` tests** — description starts collapsed; expanding reveals description copy.
6. **`ComparisonParameterPanel` tests** — default expanded; parameters key; when two panels mount with left/right ids, ids differ and sync holds.
7. **Regression** — full `bun run test` stays green. Fix assertions that assumed description body was visible without expanding first.

No new E2E required unless an existing Playwright spec fails because it targeted collapsed description content.

## Planned implementation rollout (post-approval)

Not part of the design-doc PR. After this spec is approved, implementation plan + code land separately:

1. Add storage helper + open store + tests.
2. Add `CollapsiblePanel` + tests (including two-instance id + live sync + focus).
3. Wire `ParameterPanel`, shell description, `ComparisonParameterPanel` (+ compare `side`/`bodyId` plumbing as needed).
4. Update affected component tests; run full Vitest suite.

## Resolved review items

| Item | Resolution |
|------|------------|
| Body id uniqueness | Required `bodyId` prop; canonical table above |
| Compare shared-key desync | Live sync via per-key open store (option a) |
| `hidden` override | Class-based `display: none` (e.g. Tailwind `hidden`) |
| Focus on collapse | Move focus to toggle if focus was inside body |
| SSR flash | Explicitly accept; no pre-hydration script in v1 |
| Test gaps | Store tests, two-instance ids, live sync, focus, SSR helper path |
| Type DRY | `PanelStorageKey` from `PANEL_STORAGE_KEYS` |
| `prefers-reduced-motion` | Instant chevron when reduced motion |
| Doc hygiene | Status Approved; rollout labeled post-approval |

## Open questions

None remaining after review resolution.
