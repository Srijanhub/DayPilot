/**
 * DayPilot Chrome Extension MV3 Background Service Worker
 * Tracks active focused tab, batches heartbeats in chrome.storage.local,
 * and flushes every 5-10s using chrome.alarms.
 */

const API_ENDPOINT = "http://127.0.0.1:4000/api/heartbeat";
const OPEN_TABS_ENDPOINT = "http://127.0.0.1:4000/api/tabs/open";
const ALARM_NAME = "daypilot_flush_alarm";
const FLUSH_INTERVAL_MINUTES = 0.1; // ~6 seconds

// Initialize alarms & configuration defensively on install and on startup
async function initExtension(details) {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: FLUSH_INTERVAL_MINUTES });
  const storage = await chrome.storage.local.get(["tracking_paused", "excluded_domains"]);
  if (storage.tracking_paused === undefined) {
    await chrome.storage.local.set({ tracking_paused: false });
  }
  if (!storage.excluded_domains) {
    await chrome.storage.local.set({
      excluded_domains: ["bank", "chase.com", "paypal.com", "wellsfargo.com", "accounts.google.com"]
    });
  }
}

chrome.runtime.onInstalled.addListener(initExtension);
chrome.runtime.onStartup.addListener(initExtension);

// Real-time WebSocket connection to DayPilot backend for tab activation
let ws = null;
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket("ws://127.0.0.1:4000/ws/state");
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "ACTIVATE_TAB" && msg.data) {
          handleActivateTab(msg.data);
        }
      } catch (e) {}
    };
    ws.onclose = () => { ws = null; };
    ws.onerror = () => { ws = null; };
  } catch (e) {
    ws = null;
  }
}

function handleActivateTab(data) {
  if (data && data.tab_id) {
    chrome.tabs.update(data.tab_id, { active: true }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        if (data.url) chrome.tabs.create({ url: data.url });
        return;
      }
      const winId = data.window_id || tab.windowId;
      if (winId) {
        chrome.windows.update(winId, { focused: true });
      }
    });
  }
}

// Ensure WebSocket is active
connectWebSocket();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    connectWebSocket();
    reportOpenTabs();
    collectAndFlush();
  }
});

// Listener for messages from content scripts (media telemetry)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "MEDIA_TELEMETRY" && sender.tab) {
    recordMediaEvent(sender.tab, message.payload);
  }
  sendResponse({ status: "received" });
  return true;
});

async function recordMediaEvent(tab, mediaPayload) {
  if (tab.incognito) return; // Strict privacy: Never record incognito

  const storage = await chrome.storage.local.get(["tracking_paused", "excluded_domains"]);
  if (storage.tracking_paused) return;

  const url = new URL(tab.url || "http://unknown");
  const excluded = storage.excluded_domains || [];
  if (excluded.some(d => url.hostname.includes(d))) return;

  const heartbeat = {
    app_name: "Opera GX",
    window_title: tab.title || "",
    domain: url.hostname,
    url: mediaPayload.resume_url || tab.url,
    duration_seconds: 0, // Bookmarking only: do not double-count active screen duration
    idle_seconds: 0,
    media_type: mediaPayload.media_type,
    series_title: mediaPayload.series_title,
    unit_label: mediaPayload.unit_label,
    timestamp_offset: mediaPayload.timestamp_offset
  };

  await sendToBackend(heartbeat);
}

async function collectAndFlush() {
  const storage = await chrome.storage.local.get(["tracking_paused", "excluded_domains"]);
  if (storage.tracking_paused) return;

  // Check system idle
  chrome.idle.queryState(60, async (idleState) => {
    if (idleState === "locked") return;
    const isIdle = (idleState === "idle");

    // Query active tab in the focused window
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) return;
      const activeTab = tabs[0];
      if (!activeTab.url || activeTab.incognito) return;

      try {
        const url = new URL(activeTab.url);
        const excluded = storage.excluded_domains || [];
        if (excluded.some(d => url.hostname.includes(d))) return;

        const heartbeat = {
          app_name: "Opera GX",
          window_title: activeTab.title || "",
          domain: url.hostname,
          url: activeTab.url,
          duration_seconds: 5,
          idle_seconds: isIdle ? 65 : 0
        };

        await sendToBackend(heartbeat);
      } catch (err) {
        // Invalid URL or internal chrome page (chrome://)
      }
    });
  });
}

let inMemoryToken = "";

async function getApiToken() {
  if (inMemoryToken) return inMemoryToken;
  try {
    const storage = await chrome.storage.local.get(["daypilot_api_token"]);
    if (storage.daypilot_api_token) {
      inMemoryToken = storage.daypilot_api_token;
      return inMemoryToken;
    }
  } catch (e) {}

  // Fetch from FastAPI backend
  try {
    const res = await fetch("http://127.0.0.1:4000/api/token");
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        inMemoryToken = data.token;
        await chrome.storage.local.set({ daypilot_api_token: data.token });
        return inMemoryToken;
      }
    }
  } catch (e) {}

  // Fallback: fetch from Next.js frontend
  try {
    const res = await fetch("http://localhost:3000/api/token");
    if (res.ok) {
      const data = await res.json();
      if (data && data.token) {
        inMemoryToken = data.token;
        await chrome.storage.local.set({ daypilot_api_token: data.token });
        return inMemoryToken;
      }
    }
  } catch (e) {}

  return "";
}

async function sendToBackend(payload, endpoint = API_ENDPOINT, isRetry = false) {
  let token = await getApiToken();

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DayPilot-Token": token
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401 && !isRetry) {
      inMemoryToken = "";
      await chrome.storage.local.remove(["daypilot_api_token"]);
      return await sendToBackend(payload, endpoint, true);
    }
    return res;
  } catch (e) {
    return null;
  }
}


// ---------------------------------------------------------------------------
// Live snapshot of the tabs that are open RIGHT NOW (not history).
// Re-sent on every tab/window change and on each alarm tick; the backend drops
// the snapshot automatically if the browser closes or reporting stops.
// ---------------------------------------------------------------------------
let openTabsTimer = null;
function scheduleOpenTabsReport() {
  clearTimeout(openTabsTimer);
  openTabsTimer = setTimeout(reportOpenTabs, 400);
}

async function reportOpenTabs() {
  const storage = await chrome.storage.local.get(["tracking_paused", "excluded_domains"]);
  if (storage.tracking_paused) {
    return await sendToBackend({ tabs: [], paused: true }, OPEN_TABS_ENDPOINT);
  }

  const excluded = storage.excluded_domains || [];
  let tabs = [];

  const [all, win] = await Promise.all([
    chrome.tabs.query({}),
    chrome.windows.getLastFocused().catch(() => null)
  ]);
  const windowFocused = Boolean(win && win.focused);

  tabs = all
    .filter((t) => t.url && !t.incognito && /^https?:/i.test(t.url))
    .filter((t) => {
      try { return !excluded.some((d) => new URL(t.url).hostname.includes(d)); }
      catch (e) { return false; }
    })
    .map((t) => ({
      id: t.id,
      window_id: t.windowId,
      title: t.title || "",
      url: t.url,
      active: Boolean(t.active),
      focused: Boolean(t.active && windowFocused && win && t.windowId === win.id)
    }));

  await sendToBackend({ tabs, paused: false }, OPEN_TABS_ENDPOINT);
}

chrome.tabs.onCreated.addListener(scheduleOpenTabsReport);
chrome.tabs.onRemoved.addListener(scheduleOpenTabsReport);
chrome.tabs.onActivated.addListener(scheduleOpenTabsReport);
chrome.tabs.onReplaced.addListener(scheduleOpenTabsReport);
chrome.tabs.onAttached.addListener(scheduleOpenTabsReport);
chrome.tabs.onDetached.addListener(scheduleOpenTabsReport);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) scheduleOpenTabsReport();
});
chrome.windows.onFocusChanged.addListener(scheduleOpenTabsReport);
chrome.windows.onRemoved.addListener(scheduleOpenTabsReport);
scheduleOpenTabsReport();
