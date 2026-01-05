# Product Requirements Document: Chaos Visualizer Feature Enhancements

**Document Version:** 1.1
**Date:** 2026-01-03
**Status:** Draft

---

## Executive Summary

This PRD outlines a set of feature enhancements for the Chaos Theory Visualization Platform. The goal is to increase user engagement, educational value, and shareability while maintaining the existing sci-fi aesthetic and technical excellence.

---

## Problem Statement

The current platform successfully visualizes 11 chaos systems with interactive parameters and user accounts. However, users lack the ability to:

1. **Share discoveries** - No way to share interesting configurations without recipients having accounts
2. **Learn progressively** - No guided exploration or curated presets to help newcomers
3. **Capture moments** - Only static PNG snapshots; no animation recording
4. **Compare configurations** - Cannot view two parameter sets side-by-side
5. **Navigate efficiently** - No keyboard shortcuts for power users

---

## Goals & Success Metrics

| Goal                  | Metric                     | Target           |
| --------------------- | -------------------------- | ---------------- |
| Increase shareability | Shared config link clicks  | 500/month        |
| Improve engagement    | Avg. session duration      | +40%             |
| Educational value     | Preset usage rate          | 60% of new users |
| Power user retention  | Keyboard shortcut adoption | 30% of sessions  |
| Content creation      | GIF exports per month      | 200/month        |

---

## Feature Specifications

### Feature 1: Shareable Configuration URLs

**Priority:** P0 (Critical)
**Effort:** Medium

#### Description

Generate public, read-only URLs for any configuration that can be viewed without authentication.

#### User Stories

- As a user, I want to share a link to my Lorenz configuration so my friend can see it without creating an account
- As a content creator, I want to embed chaos visualizations in my blog posts
- As a teacher, I want to send students links to specific parameter configurations

#### Functional Requirements

| ID   | Requirement                                                                     |
| ---- | ------------------------------------------------------------------------------- |
| F1.1 | "Share" button on each visualization page                                       |
| F1.2 | Generate unique short URL (e.g., `/s/abc123`)                                   |
| F1.3 | Shared view is read-only (no save, parameter changes allowed but not persisted) |
| F1.4 | Copy-to-clipboard functionality with toast confirmation                         |
| F1.5 | Optional: QR code generation for physical sharing                               |
| F1.6 | Shared configs expire after 7 days                                              |
| F1.7 | Display "Shared by [username]" attribution on shared pages                      |

#### Technical Requirements

| ID   | Requirement                                                                                                          |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| T1.1 | New `shared_configurations` table with short_code, user_id, map_type, parameters, view_count, created_at, expires_at |
| T1.5 | Background job or on-access cleanup for expired shares (7 day TTL)                                                   |
| T1.2 | Public API endpoint `GET /api/shared/[code]` (no auth required)                                                      |
| T1.3 | Rate limiting: max 10 shares per user per hour                                                                       |
| T1.4 | Short codes: 8 alphanumeric characters (62^8 = 218 trillion combinations)                                            |

#### UI/UX

- Share button positioned near existing Save button
- Modal with generated link, copy button, and optional QR code
- Shared page shows "Shared by [username]" attribution
- Expiration notice: "This link expires in X days"

---

### Feature 2: Parameter Presets Library

**Priority:** P0 (Critical)
**Effort:** Medium

#### Description

Curated collection of interesting parameter configurations with educational descriptions.

#### User Stories

- As a newcomer, I want to see famous/interesting configurations to understand what chaos looks like
- As a student, I want explanations of why certain parameters produce certain behaviors
- As a returning user, I want quick access to classic configurations

#### Functional Requirements

| ID   | Requirement                                                                 |
| ---- | --------------------------------------------------------------------------- |
| F2.1 | "Presets" dropdown/panel on each visualization page                         |
| F2.2 | Categories: "Classic", "Edge of Chaos", "Periodic", "Educational"           |
| F2.3 | Each preset includes: name, description, parameter values, difficulty level |
| F2.4 | One-click load preset (replaces current parameters)                         |
| F2.5 | Presets are system-defined (not user-generated in v1)                       |
| F2.6 | Visual preview thumbnails for each preset                                   |

#### Preset Examples

**Lorenz Attractor:**
| Preset Name | Parameters | Description |
|-------------|------------|-------------|
| Classic Butterfly | σ=10, ρ=28, β=8/3 | The original Lorenz parameters that revealed chaos |
| Periodic Window | σ=10, ρ=99.65, β=8/3 | Islands of order within chaos |
| Transient Chaos | σ=10, ρ=21, β=8/3 | System appears chaotic but eventually settles |

**Logistic Map:**
| Preset Name | Parameters | Description |
|-------------|------------|-------------|
| Period Doubling | r=3.2 → 3.57 | Watch order dissolve into chaos |
| Chaos | r=4.0 | Fully chaotic regime |
| Period-3 Window | r=3.83 | Stable period-3 orbit within chaos |

#### Technical Requirements

| ID   | Requirement                                                    |
| ---- | -------------------------------------------------------------- |
| T2.1 | Presets defined in `src/lib/presets/[map-type].ts` files       |
| T2.2 | Type-safe preset definitions matching ChaosMapParameters       |
| T2.3 | Render preset thumbnails on-demand using small canvas elements |
| T2.4 | Analytics: track which presets are most popular                |

---

### Feature 3: Animation Recording & GIF Export

**Priority:** P1 (High)
**Effort:** High

#### Description

Record visualization animations and export as GIF or WebM video files.

#### User Stories

- As a user, I want to capture the dynamic motion of the Lorenz attractor
- As a content creator, I want to create GIFs for social media
- As a teacher, I want to create video content showing chaos dynamics

#### Functional Requirements

| ID   | Requirement                                                            |
| ---- | ---------------------------------------------------------------------- |
| F3.1 | "Record" button (circle icon) next to snapshot button                  |
| F3.2 | Recording indicator (red dot, elapsed time)                            |
| F3.3 | Stop recording → processing → download prompt                          |
| F3.4 | Configurable: duration limit (5s, 10s, 30s), quality (low/medium/high) |
| F3.5 | Format: GIF (default, best compatibility); WebM as secondary option    |
| F3.6 | Works with Three.js (Lorenz, Rossler), Canvas, and D3 visualizations   |

#### Technical Requirements

| ID   | Requirement                                                              |
| ---- | ------------------------------------------------------------------------ |
| T3.1 | Use `gif.js` library for GIF encoding (web worker based)                 |
| T3.2 | Use MediaRecorder API for WebM                                           |
| T3.3 | Frame capture: `canvas.toDataURL()` or `renderer.domElement.toDataURL()` |
| T3.4 | Processing happens client-side (no server involvement)                   |
| T3.5 | Memory management: limit frame buffer, stream to encoder                 |
| T3.6 | Target: 15-30 FPS for smooth playback                                    |

#### UI/UX

- Recording button turns red when active
- Show recording time: "Recording... 0:05 / 0:30"
- Processing modal with progress bar
- Download automatically triggered or "Save As" dialog

---

### Feature 4: Side-by-Side Comparison

**Priority:** P1 (High)
**Effort:** Medium

#### Description

View two configurations of the same chaos system simultaneously.

#### User Stories

- As a researcher, I want to compare how different parameters affect the attractor
- As a student, I want to see the difference between chaotic and periodic regimes
- As a user, I want to compare my saved configuration with a preset

#### Functional Requirements

| ID   | Requirement                                                         |
| ---- | ------------------------------------------------------------------- |
| F4.1 | "Compare" mode toggle on visualization pages                        |
| F4.2 | Split-screen view (50/50 horizontal split)                          |
| F4.3 | Each side has independent parameter controls                        |
| F4.4 | Camera/view controls sync between both views (rotation, zoom, pan)  |
| F4.7 | Debounced sync (100-150ms) to prevent jitter during rapid movements |
| F4.5 | Load saved config or preset into either side                        |
| F4.6 | Swap left/right button                                              |

#### Technical Requirements

| ID   | Requirement                                                                             |
| ---- | --------------------------------------------------------------------------------------- |
| T4.1 | Duplicate visualization component with isolated parameter state but shared camera state |
| T4.5 | Debounced camera sync (100-150ms) using shared reactive store                           |
| T4.2 | URL state: `?compare=true&left={...}&right={...}`                                       |
| T4.3 | Performance: may need reduced quality for two simultaneous renders                      |
| T4.4 | Responsive: stack vertically on mobile                                                  |

---

### Feature 5: Keyboard Shortcuts

**Priority:** P2 (Medium)
**Effort:** Low

#### Description

Keyboard shortcuts for common actions to improve power user efficiency.

#### User Stories

- As a power user, I want to quickly pause/resume animations
- As a user, I want to reset parameters without clicking
- As a user, I want to take snapshots quickly

#### Shortcut Map

| Shortcut     | Action                       | Context             |
| ------------ | ---------------------------- | ------------------- |
| `Space`      | Pause/Resume animation       | Visualization pages |
| `R`          | Reset to default parameters  | Visualization pages |
| `S`          | Save snapshot (PNG)          | Visualization pages |
| `Shift+S`    | Open save config dialog      | Visualization pages |
| `P`          | Toggle presets panel         | Visualization pages |
| `?`          | Show keyboard shortcuts help | Global              |
| `Esc`        | Close modal/dialog           | Global              |
| `1-9`        | Load preset by number        | Visualization pages |
| `Cmd/Ctrl+Z` | Undo last parameter change   | Visualization pages |

#### Technical Requirements

| ID   | Requirement                                       |
| ---- | ------------------------------------------------- |
| T5.1 | Global keyboard listener in layout or per-page    |
| T5.2 | Disable when input fields are focused             |
| T5.3 | Shortcuts help modal (`?` key)                    |
| T5.4 | Store shortcut preferences in localStorage        |
| T5.5 | Accessible: announce actions via ARIA live region |

---

### Feature 6: Parameter Journey Mode

**Priority:** P2 (Medium)
**Effort:** Medium

#### Description

Smoothly animate parameter transitions over time to show how systems evolve.

#### User Stories

- As a student, I want to watch the system transition from order to chaos
- As a presenter, I want to demonstrate bifurcation through animation
- As a user, I want to explore parameter space automatically

#### Functional Requirements

| ID   | Requirement                                          |
| ---- | ---------------------------------------------------- |
| F6.1 | "Journey" button opens journey configuration modal   |
| F6.2 | Define waypoints: list of parameter snapshots        |
| F6.3 | Configurable: transition duration, easing function   |
| F6.4 | Playback controls: play, pause, restart, speed       |
| F6.5 | Loop option for continuous playback                  |
| F6.6 | Predefined journeys: "Road to Chaos" for each system |

#### Technical Requirements

| ID   | Requirement                                            |
| ---- | ------------------------------------------------------ |
| T6.1 | Parameter interpolation using linear or eased tweening |
| T6.2 | Waypoints stored as array of ChaosMapParameters        |
| T6.3 | Journeys can be saved like configurations              |
| T6.4 | Timeline UI component with waypoint markers            |

---

## Out of Scope (Future Considerations)

The following features are explicitly out of scope for this iteration:

- **VR/AR Mode** - Requires significant additional infrastructure
- **Public Gallery** - Needs moderation, social features
- **User-Generated Presets** - v1 will only have system presets
- **Real-time Collaboration** - WebSocket infrastructure not planned
- **Mobile App** - Web-first approach

---

## Technical Architecture

### New Database Tables

```sql
-- Shareable configurations (public, no auth required to view)
CREATE TABLE shared_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_code VARCHAR(8) UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  map_type VARCHAR(50) NOT NULL,
  parameters JSONB NOT NULL,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX idx_shared_short_code ON shared_configurations(short_code);

-- Parameter journeys (user-owned animation sequences)
CREATE TABLE parameter_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  map_type VARCHAR(50) NOT NULL,
  waypoints JSONB NOT NULL, -- Array of {parameters, duration_ms}
  loop BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### New Components

```
src/lib/components/
  ShareDialog.svelte        # Share URL generation modal
  PresetsPanel.svelte       # Presets dropdown/sidebar
  RecordButton.svelte       # Animation recording controls
  CompareView.svelte        # Side-by-side comparison layout
  KeyboardShortcuts.svelte  # Shortcuts help modal
  JourneyEditor.svelte      # Parameter journey configuration

src/lib/presets/
  lorenz.ts                 # Lorenz presets
  henon.ts                  # Henon presets
  ... (one per chaos system)
  index.ts                  # Aggregated exports

src/lib/recording/
  gif-encoder.ts            # GIF.js wrapper
  webm-recorder.ts          # MediaRecorder wrapper
  frame-capture.ts          # Canvas/Three.js frame capture
```

### New API Routes

```
src/routes/
  api/share/+server.ts          # POST: create shared config
  api/shared/[code]/+server.ts  # GET: retrieve shared config
  s/[code]/+page.svelte         # Public shared config viewer
  [map]/compare/+page.svelte    # Comparison mode pages
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

- [ ] Keyboard shortcuts infrastructure
- [ ] Presets data structure and initial content
- [ ] Presets UI component

### Phase 2: Sharing (Weeks 3-4)

- [ ] Shared configurations database table
- [ ] Share API endpoints
- [ ] Share dialog component
- [ ] Public shared page

### Phase 3: Recording (Weeks 5-6)

- [ ] GIF encoder integration
- [ ] Recording controls UI
- [ ] Three.js frame capture
- [ ] Canvas/D3 frame capture

### Phase 4: Advanced (Weeks 7-8)

- [ ] Comparison mode
- [ ] Parameter journeys
- [ ] Polish and bug fixes

---

## Risks & Mitigations

| Risk                        | Likelihood | Impact | Mitigation                                 |
| --------------------------- | ---------- | ------ | ------------------------------------------ |
| GIF encoding performance    | Medium     | High   | Use web workers, limit duration/resolution |
| Shared link abuse           | Low        | Medium | Rate limiting, view count monitoring       |
| Comparison mode performance | Medium     | Medium | Reduce quality, lazy render off-screen     |
| Scope creep                 | High       | High   | Strict phase boundaries, weekly reviews    |

---

## Design Decisions

| Question                 | Decision                           | Rationale                                                          |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------ |
| Shared config expiration | **7 days**                         | Keeps database clean, encourages re-sharing for persistent content |
| Attribution on shares    | **Yes, show username**             | Credits creators, builds community                                 |
| Preset thumbnails        | **Render on-demand**               | Always accurate, no asset management overhead                      |
| Recording format default | **GIF**                            | Universal compatibility (Twitter, Discord, etc.)                   |
| Comparison view sync     | **Sync with debounce (100-150ms)** | Unified viewing angle, smooth performance                          |

---

## Appendix: Preset Content Plan

### Lorenz Attractor (8 presets)

1. Classic Butterfly (σ=10, ρ=28, β=8/3)
2. Transient Chaos (ρ=21)
3. Periodic Window (ρ=99.65)
4. High Energy (ρ=200)
5. Tight Spiral (σ=4)
6. Lazy Butterfly (σ=20)
7. Compressed (β=1)
8. Wide Wings (β=4)

### Henon Map (6 presets)

1. Classic (a=1.4, b=0.3)
2. Stable Attractor (a=1.2, b=0.3)
3. Boundary Chaos (a=1.42, b=0.3)
4. Different Shape (a=1.4, b=0.2)
5. Near Divergence (a=1.5, b=0.3)
6. Conservative (b=1.0)

### Logistic Map (5 presets)

1. Stable Fixed Point (r=2.5)
2. Period-2 Cycle (r=3.2)
3. Period-4 Cycle (r=3.5)
4. Onset of Chaos (r=3.57)
5. Full Chaos (r=4.0)

_[Similar preset lists for remaining 8 chaos systems...]_

---

## Document History

| Version | Date       | Author | Changes                                         |
| ------- | ---------- | ------ | ----------------------------------------------- |
| 1.0     | 2026-01-03 | Claude | Initial draft                                   |
| 1.1     | 2026-01-03 | Claude | Resolved open questions, added design decisions |
