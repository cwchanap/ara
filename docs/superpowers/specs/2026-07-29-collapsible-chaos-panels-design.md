# Collapsible Chaos Module Control Panels

**Date:** 2026-07-29  
**Status:** Draft (awaiting user review)  
**Scope:** Make main-viz parameter and description panels, plus compare left/right parameter panels, collapsible with shared `localStorage` preferences.

## Summary

Chaos visualization pages stack chrome above and below the canvas: a `SYSTEM_PARAMETERS` panel (sliders + formula) and a description panel. Compare routes duplicate parameter chrome in left/right `ComparisonParameterPanel`s. None of these collapse today, so the canvas competes with always-open controls.

This design adds a shared `CollapsiblePanel` wrapper and a tiny storage helper so users can collapse panels to a title-bar toggle. Preferences persist in `localStorage` under two shared keys (not per map). Defaults favor interaction first: parameters open, description closed.

### Design decisions (from brainstorming)

| Decision | Choice |
|----------|--------|
| Scope | Main params + description; compare left/right panels |
| Default state | Parameters expanded; description collapsed |
| Persistence | `localStorage`, shared keys (not per-map) |
| Collapsed chrome | Title bar + chevron only |
| Architecture | Shared `CollapsiblePanel` wrapper + storage helper |
| Compare sync | Same storage key for left/right; no live cross-panel sync on the same page in v1 |
| Body when collapsed | Use `hidden` so nodes remain in the DOM for tests/queries |

## Goals

- One collapse behavior for all main chaos modules via `VisualizationShell` / `ParameterPanel`.
- Description panel on main viz pages is collapsible with the same pattern.
- Compare left/right parameter panels are collapsible and reuse the parameters preference key.
- Persist open/closed across visits without per-map keys.
- Preserve existing sci-fi styling; no math/renderer changes.

## Non-Goals

- Per-map or per-route storage keys.
- Compact summary strips, floating fabs, or drawer/sidebar layouts.
- Live two-way sync between left and right compare panels on the same page.
- Cross-tab live sync (`storage` event listeners).
- Collapsing alerts, header actions, or the visualization canvas chrome.
- Visual redesign beyond title-bar toggle + chevron.
- New Playwright E2E suite (unless an existing e2e breaks and needs a small fix).

## Architecture

```
VisualizationShell
├── ParameterPanel ──► CollapsiblePanel (key: chaos-panel:parameters, defaultOpen: true)
│                      └── sliders + formula
├── renderer (unchanged)
└── description block ──► CollapsiblePanel (key: chaos-panel:description, defaultOpen: false)

ComparisonParameterPanel ──► CollapsiblePanel (key: chaos-panel:parameters, defaultOpen: true)
```

### New pieces

| File | Purpose |
|------|---------|
| `src/lib/chaos-panel-storage.ts` | Read/write boolean preferences; SSR-safe; never throw |
| `src/lib/chaos-panel-storage.test.ts` | Unit tests for defaults, corrupt values, write failures |
| `src/lib/components/ui/CollapsiblePanel.svelte` | Title-bar toggle, body show/hide, storage wiring |
| `src/lib/components/ui/CollapsiblePanel.svelte.test.ts` | Toggle, a11y attrs, defaultOpen, storage round-trip |

### Modified files

| File | Change |
|------|--------|
| `src/lib/components/ui/ParameterPanel.svelte` | Integrate `CollapsiblePanel`; heading becomes toggle; body = children + formula |
| `src/lib/components/ui/ParameterPanel.svelte.test.ts` | Assert default expanded; toggle collapses body |
| `src/lib/components/ui/VisualizationShell.svelte` | Wrap description block in `CollapsiblePanel` |
| `src/lib/components/ui/VisualizationShell.svelte.test.ts` | Description default collapsed; params still present when expanded |
| `src/lib/components/comparison/ComparisonParameterPanel.svelte` | Integrate `CollapsiblePanel` with parameters key |
| `src/lib/components/comparison/ComparisonParameterPanel.svelte.test.ts` | Extend: default expanded; collapse; parameters storage key |

All main viz routes inherit via the shell. All compare routes inherit via `ComparisonParameterPanel`. No per-route page edits required unless a test asserts description visibility without accounting for the default collapsed state.

## Component API

### Ownership split

- **Host keeps chrome:** `ParameterPanel`, the shell description `<div>`, and `ComparisonParameterPanel` retain their existing outer card markup (corners, accent bar, padding, borders). Collapse does not restyle those shells.
- **`CollapsiblePanel` owns behavior:** title-row toggle (heading + chevron + button/`aria-*`) and show/hide of the body snippet. Hosts pass their current title string and put today’s body (sliders, formula, description copy, compare controls) in `children`.

### `CollapsiblePanel`

```ts
interface Props {
	title: string;
	storageKey: 'chaos-panel:parameters' | 'chaos-panel:description';
	defaultOpen: boolean;
	titleLevel?: 'h2' | 'h3'; // default 'h2'; main params use h2, compare/description use h3
	children: Snippet;
}
```

**Behavior**

- On mount (browser): read `storageKey`; if a valid boolean string, use it; else use `defaultOpen`.
- Toggle button (click / Enter / Space) flips state and writes storage immediately.
- Collapsed: title bar + chevron only; body has `hidden` (or equivalent) and is not tabbable.
- Expanded: existing body layout unchanged.
- Host outer card stays visible whether open or closed (only the inner body collapses).
- Chevron rotates (or equivalent) to indicate state.
- No cross-tab live sync; navigation/refresh picks up the latest stored value.

### Storage helper

```ts
export const PANEL_STORAGE_KEYS = {
	parameters: 'chaos-panel:parameters',
	description: 'chaos-panel:description'
} as const;

export function readPanelOpen(key: string, defaultOpen: boolean): boolean;
export function writePanelOpen(key: string, open: boolean): void;
```

- Server / no `window`: `readPanelOpen` returns `defaultOpen`.
- `localStorage` throws or is unavailable: read → `defaultOpen`; write → no-op.
- Corrupt values: treat as missing → `defaultOpen`; next successful toggle may overwrite with a clean `"true"` / `"false"`.

### Defaults

| Surface | `storageKey` | `defaultOpen` |
|---------|--------------|---------------|
| Main `ParameterPanel` | `chaos-panel:parameters` | `true` |
| Main description block | `chaos-panel:description` | `false` |
| Compare left/right panels | `chaos-panel:parameters` | `true` |

### Compare nuance (v1)

Left and right panels each hold their own `$state`, both seeded from the same key. Toggling one writes storage but does not force the sibling on the same page to update. After navigate/refresh, both seed from the stored value again. Live same-page sync is explicitly out of scope for v1.

## Interaction & a11y

- Toggle is a real `<button type="button">` associated with the title (not the whole card as a click target).
- `aria-expanded` reflects open state.
- `aria-controls` points at the body region `id`.
- When collapsed, body is not in the tab order.
- Title typography stays Orbitron + pulse-dot treatment consistent with current panels; description uses its existing heading text as the toggle label.

## Errors & SSR

- Storage failures never surface as UI errors or break rendering.
- First paint uses `defaultOpen` for deterministic SSR markup. Client hydrate may apply a stored preference (e.g. close description, or restore a previously closed parameters panel). A brief chrome-only flash is acceptable; no attempt to suppress it with CSS hacks in v1.

## Testing

1. **`chaos-panel-storage.test.ts`** — defaults; valid true/false; corrupt input; missing `localStorage`; write that throws.
2. **`CollapsiblePanel.svelte.test.ts`** — starts from `defaultOpen`; toggle updates `aria-expanded` and hides/shows body; persists via mocked storage.
3. **`ParameterPanel` tests** — default expanded so existing slider queries keep working; collapse hides body (`hidden`).
4. **`VisualizationShell` tests** — description starts collapsed by default; expanding reveals description copy.
5. **Comparison panel** — default expanded; uses parameters key.
6. **Regression** — full `bun run test` stays green. Fix any existing assertions that assumed description body was visible without expanding first.

No new E2E required unless an existing Playwright spec fails because it targeted collapsed description content.

## Rollout

Single PR:

1. Add storage helper + tests.
2. Add `CollapsiblePanel` + tests.
3. Wire `ParameterPanel`, shell description, `ComparisonParameterPanel`.
4. Update affected component tests; run full Vitest suite.

## Open questions

None — brainstorming resolved scope, defaults, persistence, collapsed chrome, architecture, and compare sync policy.
