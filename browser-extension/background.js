/**
 * DayPilot Chrome Extension MV3 Background Service Worker
 * Tracks active focused tab, batches heartbeats in chrome.storage.local,
 * and flushes every 5-10s using chrome.alarms.
 */

const API_ENDPOINT = "http://127.0.0.1:4000/api/heartbeat";
const OPEN_TABS_ENDPOINT = "http://127.0.0.1:4000/api/tabs/open";
const ALARM_NAME = "daypilot_flush_alarm";
const FLUSH_INTERVAL_MINUTES = 0.1; // ~6 seconds

// Initialize alarms
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: FLUSH_INTERVAL_MINUTES });
  chrome.storage.local.set({
    tracking_paused: false,
    excluded_domains: ["bank", "chase.com", "paypal.com", "wellsfargo.com", "accounts.google.com"],
    pending_heartbeats: []
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
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
  if (storage.excluded_domains.some(d => url.hostname.includes(d))) return;

  const heartbeat = {
    app_name: "Opera GX",
    window_title: tab.title || "",
    domain: url.hostname,
    url: mediaPayload.resume_url || tab.url,
    duration_seconds: 5,
    idle_seconds: 0,
    media_type: mediaPayload.media_type,
    series_title: mediaPayload.series_title,
    unit_label: mediaPayload.unit_label,
    timestamp_offset: mediaPayload.timestamp_offset
  };

  sendToBackend(heartbeat);
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
        // Excluded domains
        if (storage.excluded_domains.some(d => url.hostname.includes(d))) return;

        const heartbeat = {
          app_name: "Opera GX",
          window_title: activeTab.title || "",
          domain: url.hostname,
          url: activeTab.url,
          duration_seconds: 5,
          idle_seconds: isIdle ? 65 : 0
        };

        sendToBackend(heartbeat);
      } catch (err) {
        // Invalid URL or internal chrome page (chrome://)
      }
    });
  });
}

async function sendToBackend(payload, endpoint = API_ENDPOINT) {
  const storage = await chrome.storage.local.get(["daypilot_api_token"]);
  const token = storage.daypilot_api_token || "";

  fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-DayPilot-Token": token
    },
    body: JSON.stringify(payload)
  }).catch(() => {
    // Backend offline, fail silently
  });
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
  const excluded = storage.excluded_domains || [];
  let tabs = [];

  if (!storage.tracking_paused) {
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
  }

  sendToBackend({ tabs }, OPEN_TABS_ENDPOINT);
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
