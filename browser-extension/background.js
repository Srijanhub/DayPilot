/**
 * DayPilot Chrome Extension MV3 Background Service Worker
 * Tracks active focused tab, batches heartbeats in chrome.storage.local,
 * and flushes every 5-10s using chrome.alarms.
 */

const API_ENDPOINT = "http://127.0.0.1:4000/api/heartbeat";
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

function sendToBackend(payload) {
  fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {
    // Backend offline, fail silently
  });
}
