# DayPilot 🛸 // Flight Deck Cockpit

> **Autonomous morning command center, ambient 3D workstation, and continuous daily activity retrospective.**  
> 100% private, local-first macOS app engineered for students and developers.

---

## 1. Product Summary

DayPilot organizes your entire day around two primary synchronization points:
* **09:00 AM Morning Ignition:** Aggregates your calendar, priority emails, BossCoder Academy classes, GitHub notifications, curated newspaper digest, study playlist, quote of the day, and quick voice memo into an AI-prioritized **Daily Mission Plan**.
* **01:00 AM Nightly Retrospective:** Transforms your day's passive telemetry into interactive 24-hour spectrogram charts, **"Left Off At" manhwa and show resume cartridges**, and a planned-vs-completed **Flight Log audit**.

Between these, DayPilot acts as an ambient flight deck:
* **Living 3D WebGL Orb:** Pulsates and ripples to your cursor with Simplex 3D noise deformation and Fresnel rim glow.
* **24-Hour Dial Ring:** Encircles the orb showing real-time timeline arcs and activity blocks.
* **Context State Machine:** Automatically detects when you are in **WORK**, **STUDY**, or **RELAX** mode (with a 120-second debounce filter).
* **Ad-Free Music Engine:** Context-aware playlists that learn your listening preferences ($P(\text{genre} \mid \text{activity})$) with zero ads.

---

## 2. Architecture & Topology

```
daypilot/
├── frontend/               # Next.js 15 (App Router) + Tailwind CSS v4 + Three.js
│   ├── components/         # FlightDeckOrb, DialRing, CommandPalette, Bento Panels
│   └── store/              # Zustand state (mode, audio energy, timeline)
├── backend/                # FastAPI on 127.0.0.1:4000 + SQLite WAL (~/daypilot/data/activity.db)
│   ├── collectors/         # Google Suite, BossCoder, GitHub, Newspaper, Quotes
│   ├── classifier.py       # 120s hysteresis debounce context classifier
│   └── seed_demo.py        # Realistic zero-setup demo data seeder
├── browser-extension/      # Chrome Manifest V3 extension
│   ├── background.js       # Focus tab tracker & alarm batcher
│   └── content-scripts/    # Null-safe Manhwa/Show scrapers & YT Music relay
├── macos/                  # launchd daemons & native window watcher
│   ├── window_daemon.py    # Polls frontmost app bundle ID & idle time
│   ├── install.sh          # Registers 09:00 AM & 01:00 AM launchd plists
│   └── uninstall.sh        # Unloads launchd plists
└── memos/                  # Local audio voice thoughts directory
```

---

## 3. Quick Start & Demo Run

### A. Start the Backend API (FastAPI)
```bash
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn app:app --host 127.0.0.1 --port 4000 --reload
```

### B. Seed Realistic Demo Telemetry
To test DayPilot immediately with a realistic day of telemetry, bookmarks, and music logs:
```bash
cd backend
./venv/bin/python seed_demo.py
```

### C. Launch the Frontend Cockpit
```bash
cd frontend
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### D. Load the Opera GX Extension (MV3)
1. Open Opera GX and navigate to `opera://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** and select:
   `./browser-extension` (or `<path-to-daypilot>/browser-extension`)
4. The DayPilot HUD companion is now active in Opera GX!

---

## 4. macOS launchd Background Automation

To have DayPilot automatically wake and open your morning briefing at **09:00 AM** and generate your retrospective at **01:00 AM**:

```bash
cd macos
./install.sh
```
*To remove background daemons later:*
```bash
cd macos
./uninstall.sh
```

---

## 5. First-Run macOS Permissions Checklist

The local window daemon (`macos/window_daemon.py`) queries frontmost window titles to correlate your active coding, study, or entertainment sessions:
1. Open **System Settings > Privacy & Security > Accessibility**.
2. Grant permission to **Terminal** (or **iTerm2** / your terminal runner).
3. Under **Screen & System Audio Recording**, ensure your terminal runner is allowed if you want deep window title inspection.

---

## 6. Privacy & Legal Statement

* **100% Offline & Private:** All activity heartbeats, voice memos, and media bookmarks are stored strictly on your local SSD in `~/daypilot/data/activity.db`. No browsing logs or audio are ever uploaded to any third-party telemetry server.
* **Incognito Isolation:** The Chrome companion extension automatically halts all logging in incognito windows and excludes sensitive financial/banking domains.
* **Audio & Terms of Service Notice:** DayPilot provides pluggable music adapters. Direct audio stream extraction from YouTube may conflict with YouTube Terms of Service; DayPilot isolates stream resolution adapters and supports local offline audio libraries and browser MediaSession controls.

---

## 7. Verification & Tests

To execute the automated Python test suite:
```bash
cd backend
PYTHONPATH=. ./venv/bin/pytest
```
Test suite verifies:
* Context Classifier 120s hysteresis debounce logic.
* Instantaneous domain/app categorization.
* Pydantic morning briefing schema serialization.
* Empirical music preference learning engine.
