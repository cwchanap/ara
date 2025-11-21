# Chaos Theory Visualizations

Interactive web visualizations of various chaotic mathematical systems, built with SvelteKit, TypeScript, TailwindCSS, and shadcn-svelte.

## Overview

This project reproduces 8 different chaos theory visualizations originally written in Python:

1. **Lorenz Attractor** - 3D visualization using Three.js showing the famous butterfly attractor
2. **Hénon Map** - 2D strange attractor visualization using D3.js
3. **Logistic Map** - Population dynamics showing transition to chaos
4. **Bifurcation Diagram (Logistic)** - Canvas-based bifurcation visualization
5. **Bifurcation Diagram (Hénon)** - Bifurcation patterns of the Hénon map
6. **Newton Fractal** - Complex fractal from Newton's method iterations
7. **Standard Map** - Area-preserving chaotic map visualization
8. **Chaos Esthetique** - Custom aesthetic chaos pattern

## Technologies

- **SvelteKit** - Web framework with TypeScript
- **TailwindCSS** - Utility-first CSS framework
- **shadcn-svelte** - Beautiful UI components
- **D3.js** - Data visualization for 2D plots
- **Three.js** - 3D rendering for Lorenz attractor
- **Canvas API** - High-performance rendering for fractals

## Getting Started

### Install Dependencies

```sh
npm install
```

### Run Development Server

```sh
npm run dev

# or open in browser automatically
npm run dev -- --open
```

The app will be available at `http://localhost:5173`

## Features

- **Interactive Parameters** - Adjust mathematical parameters in real-time
- **Responsive Design** - Works on desktop and mobile devices
- **Beautiful UI** - Modern gradient backgrounds and smooth animations
- **Performance Optimized** - Efficient rendering for complex visualizations

## Project Structure

```
.
├── src/
│   ├── routes/
│   │   ├── +layout.svelte              # Main layout with navigation
│   │   ├── +page.svelte                # Homepage with visualization cards
│   │   ├── lorenz/+page.svelte         # Lorenz attractor (Three.js)
│   │   ├── henon/+page.svelte          # Hénon map (D3.js)
│   │   ├── logistic/+page.svelte       # Logistic map (D3.js)
│   │   ├── bifurcation-logistic/       # Bifurcation diagram
│   │   ├── bifurcation-henon/          # Hénon bifurcation
│   │   ├── newton/+page.svelte         # Newton fractal (Canvas)
│   │   ├── standard/+page.svelte       # Standard map (D3.js)
│   │   └── chaos-esthetique/           # Aesthetic chaos
│   └── lib/
│       ├── components/                 # shadcn-svelte components
│       └── utils/                      # Utility functions
├── chaos/                              # Original Python reference scripts
└── package.json
```

## Building for Production

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Mathematical Formulas

### Lorenz Attractor
```
dx/dt = σ(y - x)
dy/dt = x(ρ - z) - y
dz/dt = xy - βz
```

### Hénon Map
```
x(n+1) = y(n) + 1 - a·x(n)²
y(n+1) = b·x(n)
```

### Logistic Map
```
x(n+1) = r·x(n)·(1 - x(n))
```

### Standard Map
```
p(n+1) = p(n) + K·sin(q(n)) mod 2π
q(n+1) = q(n) + p(n+1) mod 2π
```

## License

MIT
