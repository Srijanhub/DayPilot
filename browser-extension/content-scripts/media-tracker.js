/**
 * DayPilot Media Tracker Content Script
 * Null-safe extraction of manhwa/manga chapter bookmarks and video streaming progress.
 */

(function () {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname;
  const pageTitle = document.title || "";

  // 1. MANHWA / MANGA / MANHUA DETECTION (Null-safe extraction)
  const isManhwaSite = [
    "asura", "flamecomics", "mangadex", "webtoons", "reaper", "toongod",
    "mangakakalot", "chapmanganato", "manganato", "void-scans", "cosmicscans",
    "zeroscans", "bato.to", "manhuafast", "manhwatop"
  ].some(site => hostname.includes(site)) || (
    /chapter\s*\d+/i.test(pageTitle) && /(?:manhwa|manga|manhua|webtoon|comic|scan)/i.test(pageTitle + " " + hostname)
  );

  if (isManhwaSite) {
    let seriesTitle = "";
    let chapterNum = "";

    // Null-safe extraction strategy 1: URL Route matching
    // Example: /webtoon/academys-genius-swordsman/chapter-76/ or /series/solo-leveling/chapter-120/
    const urlSeriesMatch = pathname.match(/(?:webtoon|series|title|manga)\/([^\/]+)/i);
    if (urlSeriesMatch && urlSeriesMatch[1]) {
      seriesTitle = urlSeriesMatch[1].replace(/[-_]/g, " ").trim();
      // Capitalize words
      seriesTitle = seriesTitle.replace(/\b\w/g, c => c.toUpperCase());
    }

    const urlChapterMatch = pathname.match(/chapter[^\d]*(\d+(?:\.\d+)?)/i);
    if (urlChapterMatch && urlChapterMatch[1]) {
      chapterNum = urlChapterMatch[1];
    }

    // Strategy 2: Document title fallback if not found in URL
    if (!seriesTitle || !chapterNum) {
      // Example: "Solo Leveling - Chapter 120 - Asura Scans"
      const titleParts = pageTitle.split(/[-–|]/);
      if (!seriesTitle && titleParts.length > 0) {
        seriesTitle = titleParts[0].trim();
      }

      const titleChapterMatch = pageTitle.match(/chapter[^\d]*(\d+(?:\.\d+)?)/i);
      if (!chapterNum && titleChapterMatch && titleChapterMatch[1]) {
        chapterNum = titleChapterMatch[1];
      }
    }

    // Strategy 3: DOM Selectors fallback
    if (!chapterNum) {
      const headingEl = document.querySelector("h1, h2, .entry-title, .chapter-title");
      if (headingEl && headingEl.textContent) {
        const domMatch = headingEl.textContent.match(/chapter[^\d]*(\d+(?:\.\d+)?)/i);
        if (domMatch && domMatch[1]) {
          chapterNum = domMatch[1];
        }
      }
    }

    if (seriesTitle && chapterNum) {
      chrome.runtime.sendMessage({
        type: "MEDIA_TELEMETRY",
        payload: {
          media_type: "MANHWA",
          series_title: seriesTitle,
          unit_label: `Chapter ${chapterNum}`,
          timestamp_offset: null
        }
      }).catch(() => {});
    }
  }

  // 2. VIDEO STREAMING DETECTION (Netflix, Crunchyroll, Aniwatch, YouTube)
  const isVideoSite = [
    "netflix.com", "crunchyroll.com", "aniwatch.to", "youtube.com"
  ].some(site => hostname.includes(site));

  if (isVideoSite) {
    function inspectVideo() {
      const video = document.querySelector("video");
      if (!video) return;

      let title = "";
      let unit = "";

      if (hostname.includes("youtube.com")) {
        // Exclude music.youtube.com (handled by ytmusic.js)
        if (hostname.includes("music.")) return;
        const ytTitleEl = document.querySelector("h1.ytd-video-primary-info-renderer, h1.title yt-formatted-string");
        title = ytTitleEl ? ytTitleEl.textContent.trim() : pageTitle.replace("- YouTube", "").trim();
        unit = "Video";
      } else if (hostname.includes("netflix.com")) {
        const netflixTitle = document.querySelector(".video-title, [data-uia='video-title']");
        title = netflixTitle ? netflixTitle.textContent.trim() : pageTitle;
        unit = "Episode";
      } else {
        title = pageTitle.split(/[-–|]/)[0].trim();
        unit = "Episode";
      }

      if (title && !video.paused) {
        const currentSecs = Math.floor(video.currentTime);
        const mins = Math.floor(currentSecs / 60);
        const secs = currentSecs % 60;
        const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

        chrome.runtime.sendMessage({
          type: "MEDIA_TELEMETRY",
          payload: {
            media_type: "SHOW",
            series_title: title,
            unit_label: unit,
            timestamp_offset: timeStr
          }
        }).catch(() => {});
      }
    }

    // Monitor video playback periodically
    setInterval(inspectVideo, 10000);
  }
})();
