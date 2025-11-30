# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SvelteKit-based interactive web application that visualizes 8 different chaos theory mathematical systems. The project reproduces Python-based chaos visualizations using modern web technologies, featuring real-time parameter manipulation and beautiful sci-fi themed UI.

## Development Commands

### Development Server

```bash
npm run dev                 # Start dev server
npm run dev -- --open      # Start and open in browser (http://localhost:5173)
```

### Build & Preview

```bash
npm run build              # Build for production
npm run preview            # Preview production build
```

### Code Quality

```bash
npm run check              # Run svelte-check for type errors
npm run check:watch        # Run svelte-check in watch mode
npm run lint               # Run ESLint and Prettier checks
npm run format             # Format all files with Prettier
```

Note: Pre-commit hooks automatically run linting and formatting via `lint-staged`.

## Architecture

### Tech Stack

- **Framework**: SvelteKit (Svelte 5 with runes)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: TailwindCSS v4 with custom utility classes
- **Visualizations**:
  - Three.js (3D - Lorenz attractor)
  - D3.js (2D plots - Hénon, Logistic, Standard maps)
  - Canvas API (fractals and bifurcation diagrams)
- **Deployment**: Netlify (adapter-netlify)

### Code Patterns

#### Svelte 5 Runes

This project uses Svelte 5's new runes syntax:

- `$state()` for reactive variables
- `$effect()` for reactive side effects (replaces `$:` reactive statements)
- `$props()` for component props

#### Reactive Parameter Updates

All visualization pages follow this pattern:

```typescript
let param = $state(initialValue);

$effect(() => {
	void param; // Track dependency
	if (recreate) recreate();
});
```

#### Three.js Setup (Lorenz)

- Scene background is `null` (transparent) to show CSS background
- Uses OrbitControls with auto-rotation
- Cleanup: dispose renderer, remove event listeners, set `isAnimating = false`

#### D3.js Visualizations (Hénon, Logistic, Standard)

- Manual clearing: `d3.select(container).selectAll('*').remove()`
- Sci-fi styled axes with cyan colors (`#00f3ff`)
- Gradient color schemes (cyan to magenta)

#### Canvas Rendering (Bifurcation, Newton)

- Use `isRendering` flag to prevent concurrent renders
- Direct pixel manipulation with `fillRect()`
- Performance optimization via density limiting

#### Web Workers

`src/lib/workers/chaosMapsWorker.ts` handles heavy computations for Standard Map and Chaos Esthetique visualizations to prevent UI blocking.

### File Structure

```
src/
├── routes/
│   ├── +layout.svelte              # App layout with nav & background
│   ├── +page.svelte                # Homepage with visualization cards
│   ├── lorenz/+page.svelte         # Three.js 3D visualization
│   ├── henon/+page.svelte          # D3.js 2D plot
│   ├── logistic/+page.svelte       # D3.js line chart
│   ├── bifurcation-logistic/       # Canvas bifurcation
│   ├── bifurcation-henon/          # Canvas bifurcation
│   ├── newton/+page.svelte         # Canvas fractal
│   ├── standard/+page.svelte       # D3.js with web worker
│   └── chaos-esthetique/           # Canvas with web worker
└── lib/
    ├── workers/                     # Web workers for heavy computation
    └── utils.ts                     # Utility functions
```

### Styling Conventions

The app uses a **sci-fi chaos theory aesthetic**:

- Primary color: Neon cyan (`#00f3ff`)
- Accent: Magenta/purple
- Font: "Orbitron" (headings), "Rajdhani" (body)
- Naming: UPPERCASE_SNAKE_CASE for titles (e.g., "LORENZ_ATTRACTOR")
- UI elements: Corner borders, glowing effects, backdrop blur, tech grid background

### Important Configuration

**Base Path Handling**: All routes use `{base}` from `$app/paths` for proper deployment on non-root paths.

**Vite Config**: The `chaos/` directory (Python reference scripts) is ignored in watch mode.

**TypeScript**: Strict mode enabled. Path aliases managed by SvelteKit.

**Deployment**: Uses Netlify adapter. The build command in `netlify.toml` uses `bun` but `npm` works too.

## Common Development Tasks

### Adding a New Visualization

1. Create route: `src/routes/visualization-name/+page.svelte`
2. Choose rendering library (Three.js, D3.js, or Canvas)
3. Follow existing patterns for reactive parameters with `$state()` and `$effect()`
4. Add to `visualizations` array in `src/routes/+page.svelte`
5. Include sci-fi themed UI (corner borders, cyan colors, Orbitron font)
6. Add mathematical formula display in control panel

### Performance Considerations

- **Bifurcation diagrams**: Limit iterations and image resolution for responsiveness
- **Heavy computations**: Use web workers (see `chaosMapsWorker.ts`)
- **Canvas operations**: Use `isRendering` flags to prevent concurrent renders
- **D3 cleanup**: Always clear previous elements before re-rendering

### Debugging Visualizations

- Check browser console for mathematical errors (NaN, Infinity)
- Verify parameter ranges produce valid results
- Test cleanup on component unmount (memory leaks)
- Confirm reactive updates trigger re-renders correctly

## Active Technologies

- TypeScript 5.9+ (strict mode) (002-supabase-auth)
- Supabase PostgreSQL (hosted) with `profiles` table for username storage (002-supabase-auth)

## Recent Changes

- 002-supabase-auth: Added TypeScript 5.9+ (strict mode)
