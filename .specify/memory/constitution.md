<!--
## Sync Impact Report
- Version change: N/A → 1.0.0 (Initial ratification)
- Added sections:
  - Core Principles (5 principles)
  - Performance Standards
  - Development Workflow
  - Governance
- Templates requiring updates:
  - `.specify/templates/plan-template.md` ✅ (aligned - uses Constitution Check section)
  - `.specify/templates/spec-template.md` ✅ (aligned - user story format compatible)
  - `.specify/templates/tasks-template.md` ✅ (aligned - phase structure supports principles)
- Follow-up TODOs: None
-->

# Ara Constitution

## Core Principles

### I. Svelte 5 Runes Pattern

All reactive state management MUST use Svelte 5 runes syntax exclusively:

- Use `$state()` for reactive variables
- Use `$effect()` for reactive side effects (replaces legacy `$:` statements)
- Use `$props()` for component props
- Follow the dependency tracking pattern: `void param;` to explicitly track dependencies

**Rationale**: Consistent reactivity patterns ensure predictable updates across all
visualizations and prevent mixing legacy/modern syntax that causes maintenance burden.

### II. Visualization Library Selection

Each visualization MUST use the appropriate rendering library based on its requirements:

- **Three.js**: 3D visualizations (e.g., Lorenz attractor)
- **D3.js**: 2D plots with axes and data binding (e.g., Hénon, Logistic, Standard maps)
- **Canvas API**: High-performance pixel manipulation (e.g., fractals, bifurcation diagrams)
- **Web Workers**: Heavy computations that would block the UI thread

**Rationale**: Matching the rendering library to the visualization type ensures optimal
performance and appropriate abstraction level for each use case.

### III. Cleanup Discipline (NON-NEGOTIABLE)

All visualization components MUST implement proper cleanup to prevent memory leaks:

- Three.js: dispose renderer, remove event listeners, set `isAnimating = false`
- D3.js: `d3.select(container).selectAll('*').remove()` before re-render
- Canvas: use `isRendering` flags to prevent concurrent renders
- Web Workers: terminate workers on component unmount

**Rationale**: Visualization components create significant resources (WebGL contexts,
DOM elements, worker threads) that must be explicitly released.

### IV. Sci-Fi Aesthetic Consistency

All UI elements MUST adhere to the established sci-fi chaos theory aesthetic:

- Primary color: Neon cyan (`#00f3ff`)
- Accent: Magenta/purple gradients
- Typography: "Orbitron" (headings), "Rajdhani" (body)
- Naming convention: UPPERCASE_SNAKE_CASE for visualization titles
- UI patterns: Corner borders, glowing effects, backdrop blur, tech grid background

**Rationale**: Visual consistency reinforces the project's identity and provides a
cohesive user experience across all 8+ visualizations.

### V. Base Path Compliance

All internal navigation and asset references MUST use `{base}` from `$app/paths`:

- Route links: `href="{base}/visualization-name"`
- Asset paths: Use relative imports or base-prefixed paths

**Rationale**: Enables deployment to non-root paths (e.g., subdirectories on Netlify)
without broken links or missing assets.

## Performance Standards

Visualization performance requirements:

- **Frame rate**: Maintain 60fps during animation and parameter adjustment
- **Initial render**: Complete within 500ms of navigation
- **Parameter updates**: Reflect changes within 100ms
- **Heavy computations**: MUST use web workers if processing exceeds 50ms
- **Bifurcation diagrams**: Limit iterations and resolution for responsiveness

Code quality gates:

- `npm run check` MUST pass (svelte-check for type errors)
- `npm run lint` MUST pass (ESLint + Prettier)
- No console errors during normal operation
- Mathematical edge cases (NaN, Infinity) MUST be handled gracefully

## Development Workflow

### Adding New Visualizations

1. Create route at `src/routes/[visualization-name]/+page.svelte`
2. Select rendering library per Principle II
3. Implement reactive parameters with `$state()` and `$effect()` per Principle I
4. Add visualization card to `src/routes/+page.svelte` homepage array
5. Include mathematical formula display in control panel
6. Apply sci-fi themed UI per Principle IV
7. Implement cleanup per Principle III
8. Verify base path compliance per Principle V

### Pre-Commit Requirements

- Lint-staged hooks automatically run linting and formatting
- All visualization pages must render without errors
- Parameter controls must update visualization in real-time

## Governance

This constitution supersedes all other development practices for the Ara project.

**Amendment Process**:

1. Proposed changes must be documented with rationale
2. Changes must not break existing visualizations
3. Version must be incremented per semantic versioning:
   - MAJOR: Principle removal or incompatible redefinition
   - MINOR: New principle or material expansion
   - PATCH: Clarification or wording refinement

**Compliance**: All PRs and code reviews must verify adherence to these principles.
Use `AGENTS.md` for runtime development guidance and implementation patterns.

**Version**: 1.0.0 | **Ratified**: 2025-11-26 | **Last Amended**: 2025-11-26
