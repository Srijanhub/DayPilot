# DayPilot Decisions Log

This document records architectural, design, and implementation decisions made during autonomous execution.

| Decision ID | Context / Question | Decision | Rationale |
|:---|:---|:---|:---|
| D-001 | Frontend Architecture | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Three.js | Standard modern stack with fast HMR and seamless WebGL integration. |
| D-002 | Design Aesthetics | "Flight Deck" / Cockpit Instrument HUD | Per specification: avoid generic AI SaaS gradients. Use OKLCH tokens, hairline etched borders with corner ticks, and 24h dial ring. |
| D-003 | Audio & YouTube Music | Pluggable MusicSource with HTML5 audio + simulated audio visualizer + extension relay | Provides 100% ad-free playback while respecting terms and isolating extraction adapters. |
| D-004 | Local Database | SQLite with WAL mode at `~/daypilot/data/activity.db` | High concurrent write tolerance for 5s heartbeats with zero external server dependencies. |
| D-005 | Transcription Engine | Pluggable `faster-whisper` / `whisper.cpp` / Mock fallback | Allows zero-setup initial run while supporting high-accuracy local transcription when models are installed. |
| D-006 | LLM Synthesizer | Pluggable provider (Ollama / Gemini / Anthropic / Rule-based fallback) | Guarantees the briefing works offline even without API keys. |
