# DayPilot Tasks
Status: IN PROGRESS | Current: P1-T01 | Last updated: 2026-11-18 10:24

## Phase 1: 3D Orb, Flight Deck Design System & Cockpit Shell
- [ ] P1-T01 Scaffold Next.js + TS + Tailwind CSS v4 in `daypilot/frontend`
      Done when: `npm run build` succeeds cleanly.
- [ ] P1-T02 Implement Flight Deck design tokens (OKLCH CSS variables, fonts, etched panels, corner ticks, film grain)
      Done when: global CSS and layout render with dark flight-deck aesthetic and grain overlay.
- [ ] P1-T03 Implement Three.js interactive 3D Orb with Simplex noise vertex displacement and Fresnel rim glow
      Done when: Orb renders at 60 FPS in canvas, responds to mouse cursor with inertia/lerp.
- [ ] P1-T04 Implement 24-Hour Timeline Dial Ring around the orb with arc segments and hover tooltip
      Done when: 24h dial ring encircles orb with interactive time marker.
- [ ] P1-T05 Implement Audio-Reactive shader uniforms and Phase-Shift state transitions
      Done when: mode switches trigger contract-shockwave-expand animation and smooth color lerp.
- [ ] P1-T06 Build Flight Deck Cockpit layout (Asymmetric bento grid, segmented mode control, boot sequence, ⌘K palette)
      Done when: Dashboard shell renders with tactile segmented controls, ⌘K command palette, and boot sequence.
### Phase 1 Gate
- [ ] Build, lint, and typecheck clean
- [ ] Anti-generic checklist passed (no purple SaaS gradients, no default Inter, etched tactile panels)
- [ ] Committed: `phase-1: flight deck 3d orb and dashboard shell`

## Phase 2: Local Backend, SQLite Storage & Context Classifier
- [ ] P2-T01 Scaffold FastAPI backend on 127.0.0.1:4000 with strict CORS and SQLite WAL initialization
      Done when: Backend boots, `GET /api/context` returns status 200.
- [ ] P2-T02 Implement SQLite schema (activity_events, media_bookmarks, voice_memos, daily_audits, music_preferences, settings)
      Done when: Tables and indexes verify cleanly on startup.
- [ ] P2-T03 Implement Context Classifier with 120s hysteresis debounce logic and idle timeout filter
      Done when: Unit tests pass for classifier transitions and debounce thresholds.
- [ ] P2-T04 Implement Heartbeat Ingestion API (`POST /api/heartbeat`) and WebSocket state broadcast (`/ws/state`)
      Done when: Ingested heartbeats update SQLite and push state to connected WebSocket clients.
- [ ] P2-T05 Implement Manual Context Override API (`POST /api/context/override`)
      Done when: Overriding mode locks context and notifies WebSocket.
### Phase 2 Gate
- [ ] Python unit tests pass (pytest)
- [ ] Committed: `phase-2: backend core, sqlite wal, and context classifier`

## Phase 3: Browser Extension (Manifest V3) & Media Scrapers
- [ ] P3-T01 Scaffold Chrome Extension MV3 with service worker, alarms, and offline batch queue
      Done when: Extension loads unpacked with valid manifest and alarm loop.
- [ ] P3-T02 Implement focused active tab tracker with idle detection and domain exclusions
      Done when: Only focused non-idle tab sends heartbeats; incognito and excluded domains ignored.
- [ ] P3-T03 Implement null-safe Manhwa/Manga scraper (Webtoons, Asura, Flame, MangaDex, Reaper)
      Done when: Scrapes series title and chapter number without runtime exceptions on non-matching tabs.
- [ ] P3-T04 Implement Video Streaming scraper (Netflix, Crunchyroll, Aniwatch, YouTube)
      Done when: Captures video title, episode, duration, and timestamp offset.
- [ ] P3-T05 Implement YouTube Music MediaSession relay and popup status UI
      Done when: Popup shows active mode, pause toggle, and media session metadata relay works.
### Phase 3 Gate
- [ ] Extension manifest linted and verified
- [ ] Committed: `phase-3: chrome extension mv3 with media scrapers`

## Phase 4: Integrations, Morning Ignition & Voice Memos
- [ ] P4-T01 Implement Google Calendar and Gmail collectors (OAuth + graceful offline stub)
      Done when: Returns structured events and priority emails.
- [ ] P4-T02 Implement BossCoder Academy client (session/token fetcher + graceful stub)
      Done when: Returns upcoming classes, assignments, and test schedules.
- [ ] P4-T03 Implement GitHub Notifications collector (`gh api /notifications` + stub)
      Done when: Returns unread PR reviews and issue mentions.
- [ ] P4-T04 Implement Morning Newspaper RSS aggregator and Pydantic validated briefing synthesizer
      Done when: RSS feeds fetch and LLM briefing returns validated structured JSON.
- [ ] P4-T05 Implement Offline Quote Pool (≥200 curated quotes) and Study Playlist resume widget
      Done when: Quote selects daily by date hash and playlist card displays resume link.
- [ ] P4-T06 Implement In-Browser Voice Memo recorder and local storage (`/api/memos/upload`)
      Done when: Browser mic records audio blob, uploads to backend, and stores in `~/daypilot/memos`.
### Phase 4 Gate
- [ ] Morning briefing end-to-end integration verified
- [ ] Committed: `phase-4: morning briefing pipeline, integrations, and voice memos`

## Phase 5: Ad-Free YouTube Music Engine & Preference Learning
- [ ] P5-T01 Implement MusicSource abstraction with HTML5 Audio and local/Piped/YT adapters
      Done when: Audio player plays tracks with play, pause, seek, and volume controls.
- [ ] P5-T02 Implement Mode-Aware Auto-Queueing across the 4 clusters (Deep Focus, Study, Chill, Leisure)
      Done when: Mode change auto-queues appropriate playlist tracks.
- [ ] P5-T03 Implement Preference Learning engine ($P(\text{genre} \mid \text{activity})$)
      Done when: Play events update SQLite and suggest tracks with explanation text.
- [ ] P5-T04 Connect Audio Visualizer / BPM pulse to 3D Orb shader displacement
      Done when: Playing audio visibly modulates the orb's amplitude and rim intensity.
### Phase 5 Gate
- [ ] Music playback and visualizer verified
- [ ] Committed: `phase-5: ad-free music engine and preference learning`

## Phase 6: Nightly Retrospective, macOS Daemons & Demo Seed
- [ ] P6-T01 Implement 01:00 AM Nightly Retrospective generator with Spectrogram Ribbon and Focus Score
      Done when: Computes stats, generates custom SVG spectrogram ribbon and 0-100 Focus Score.
- [ ] P6-T02 Implement Cartridge-style Resume Cards for manhwa and shows
      Done when: Renders resume cards with direct links and progress bars.
- [ ] P6-T03 Implement Planned vs Completed Flight Log audit with carried-over task scheduler
      Done when: Flight log vertical timeline shows completed items and carries over unfinished items.
- [ ] P6-T04 Create Realistic Demo Seed script (`seed_demo.py`)
      Done when: Running seed script populates SQLite with realistic daily telemetry and bookmarks.
- [ ] P6-T05 Implement macOS launchd plists (`com.daypilot.morning.plist`, `com.daypilot.nightly.plist`) and install/uninstall scripts
      Done when: Plists and scripts written with catch-up logic on wake.
- [ ] P6-T06 Comprehensive system test, documentation, and README
      Done when: Full end-to-end verification passes, clean code audit, and final report generated.
### Phase 6 Gate
- [ ] All checks passed, README and documentation complete
- [ ] Committed: `phase-6: nightly retrospective, macos launchd, seed script, and final docs`
