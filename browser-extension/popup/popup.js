document.addEventListener("DOMContentLoaded", async () => {
  const modeDisplay = document.getElementById("modeDisplay");
  const trackingState = document.getElementById("trackingState");
  const togglePauseBtn = document.getElementById("togglePauseBtn");

  // Load storage state
  const storage = await chrome.storage.local.get(["tracking_paused"]);
  updateBtnText(storage.tracking_paused);

  // Query backend for committed mode
  fetch("http://127.0.0.1:4000/api/context")
    .then(res => res.json())
    .then(data => {
      modeDisplay.textContent = data.mode || "WORK";
    })
    .catch(() => {
      modeDisplay.textContent = "OFFLINE";
    });

  togglePauseBtn.addEventListener("click", async () => {
    const current = await chrome.storage.local.get(["tracking_paused"]);
    const newState = !current.tracking_paused;
    await chrome.storage.local.set({ tracking_paused: newState });
    updateBtnText(newState);
  });

  function updateBtnText(isPaused) {
    if (isPaused) {
      trackingState.textContent = "PAUSED";
      trackingState.style.color = "#f59e0b";
      togglePauseBtn.textContent = "RESUME TRACKING";
    } else {
      trackingState.textContent = "ACTIVE";
      trackingState.style.color = "#38bdf8";
      togglePauseBtn.textContent = "PAUSE TRACKING";
    }
  }
});
