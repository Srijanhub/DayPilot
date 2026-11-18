# DayPilot Human Blockers & Setup Items

The system automatically runs in a fully functional mock/offline mode out-of-the-box. The items below require human credentials, physical browser interactions, or macOS permission grants to link to real third-party services.

| Item | Service / Component | Required Human Action | Status |
|:---|:---|:---|:---|
| B-001 | Opera GX Extension | In Opera GX, go to `opera://extensions`, enable **Developer mode** (top right), click **Load unpacked**, and select `/Users/srijanhalder/Desktop/Experiments/daypilot/browser-extension`. | Ready for load |
| B-002 | macOS Permissions | The window daemon requires Accessibility & Screen Recording permissions to capture active window titles. Enable in `System Settings > Privacy & Security > Accessibility`. | Documented in UI checklist |
| B-003 | Google Workspace | To enable real Gmail & Calendar sync outside the mock stub, add OAuth credentials to `backend/.env`. | Stubbed gracefully |
| B-004 | BossCoder Academy | Store active session cookie or Bearer token in macOS Keychain or `backend/.env` for live portal sync. | Stubbed gracefully |
| B-005 | GitHub PAT | Set `GITHUB_TOKEN` in `backend/.env` or ensure `gh auth login` is configured in your terminal. | Ready for local token |
| B-006 | launchd Daemons | Run `./macos/install.sh` to register the 09:00 AM and 01:00 AM launchd background timers when ready. | Ready for execution |
