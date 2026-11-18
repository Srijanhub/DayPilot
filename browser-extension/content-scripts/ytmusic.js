/**
 * DayPilot YouTube Music Relay Content Script
 * Observes music.youtube.com playback state via navigator.mediaSession
 * and DOM controls, and relays metadata to DayPilot backend.
 */

(function () {
  let lastTrack = "";

  function checkTrack() {
    if ("mediaSession" in navigator && navigator.mediaSession.metadata) {
      const meta = navigator.mediaSession.metadata;
      const currentTrack = `${meta.title} — ${meta.artist}`;

      if (currentTrack !== lastTrack && meta.title) {
        lastTrack = currentTrack;
        chrome.runtime.sendMessage({
          type: "MEDIA_TELEMETRY",
          payload: {
            media_type: "YOUTUBE_MUSIC",
            series_title: meta.title,
            unit_label: meta.artist || "Unknown Artist",
            timestamp_offset: meta.album || ""
          }
        }).catch(() => {});
      }
    }
  }

  // Poll for track changes
  setInterval(checkTrack, 4000);

  // Relay playback controls from DayPilot
  window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "DAYPILOT_REMOTE") {
      const action = event.data.action;
      const playPauseBtn = document.querySelector("#play-pause-button");
      const nextBtn = document.querySelector(".next-button");
      const prevBtn = document.querySelector(".previous-button");

      if (action === "TOGGLE" && playPauseBtn) playPauseBtn.click();
      if (action === "NEXT" && nextBtn) nextBtn.click();
      if (action === "PREV" && prevBtn) prevBtn.click();
    }
  });
})();
