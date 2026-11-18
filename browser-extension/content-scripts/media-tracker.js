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

  // 2. VIDEO STREAMING DETECTION (Crunchyroll, HiAnime, Netflix, Disney+ Hotstar, Prime Video, YouTube)
  const isVideoSite = [
    "crunchyroll.com", "hianime.to", "aniwatch.to", "9animetv.to", "aniwave.to",
    "netflix.com", "hotstar.com", "disneyplus.com", "primevideo.com", "youtube.com"
  ].some(site => hostname.includes(site));

  if (isVideoSite) {
    function formatTime(secs) {
      if (!secs || isNaN(secs)) return null;
      const s = Math.floor(secs);
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const remainingSecs = s % 60;
      if (hrs > 0) {
        return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
      }
      return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
    }

    function getResumeUrl(currentTimeSec) {
      const href = window.location.href;
      try {
        const u = new URL(href);
        if (hostname.includes("youtube.com") && currentTimeSec > 5) {
          u.searchParams.set("t", `${Math.floor(currentTimeSec)}s`);
          return u.toString();
        }
        return href;
      } catch (e) {
        return href;
      }
    }

    function inspectVideo() {
      const video = document.querySelector("video");
      if (!video) return;

      let title = "";
      let unit = "";
      let mediaType = "SHOW";

      if (hostname.includes("youtube.com")) {
        if (hostname.includes("music.")) return; // Exclude music
        const ytTitleEl = document.querySelector("ytd-watch-metadata #title h1 yt-formatted-string, h1.ytd-video-primary-info-renderer, #title h1");
        title = ytTitleEl ? ytTitleEl.textContent.trim() : pageTitle.replace("- YouTube", "").trim();
        
        // Extract episode or part if present
        const epMatch = title.match(/(?:ep\.?|episode|part)\s*(\d+)/i);
        const hashMatch = title.match(/#(\d+)/);
        if (epMatch) {
          unit = `Episode ${epMatch[1]}`;
        } else if (hashMatch) {
          unit = `Part ${hashMatch[1]}`;
        } else {
          unit = "Video";
        }
        mediaType = "SHOW";
      } else if (hostname.includes("crunchyroll.com")) {
        mediaType = "ANIME";
        const crTitleEl = document.querySelector("h1.heading--is-family-type-heavy, h1.title");
        title = crTitleEl ? crTitleEl.textContent.trim() : pageTitle.replace(" - Watch on Crunchyroll", "").trim();
        
        const epMatch = title.match(/(?:s\d+\s*e\d+|episode\s*\d+|ep\.?\s*\d+[^–|-]*)/i);
        if (epMatch) {
          unit = epMatch[0].trim();
          title = title.replace(epMatch[0], "").split(/[-–|]/)[0].trim();
        } else {
          unit = "Episode";
        }
      } else if (hostname.includes("hianime.to") || hostname.includes("aniwatch.to") || hostname.includes("9anime")) {
        mediaType = "ANIME";
        const animeNameEl = document.querySelector(".film-name a, .heading--is-family-type-heavy");
        title = animeNameEl ? animeNameEl.textContent.trim() : pageTitle.replace(/^Watch\s+/i, "").split(/[-–|]/)[0].trim();
        
        const epActive = document.querySelector(".ep-item.active");
        if (epActive) {
          unit = `Episode ${epActive.getAttribute("data-number") || epActive.textContent.trim()}`;
        } else {
          const epMatch = pageTitle.match(/episode\s*(\d+)/i);
          unit = epMatch ? `Episode ${epMatch[1]}` : "Episode";
        }
      } else if (hostname.includes("netflix.com")) {
        mediaType = "SHOW";
        const netflixTitle = document.querySelector(".video-title, [data-uia='video-title']");
        if (netflixTitle) {
          const h4 = netflixTitle.querySelector("h4");
          const span = netflixTitle.querySelector("span");
          title = h4 ? h4.textContent.trim() : netflixTitle.textContent.trim();
          unit = span ? span.textContent.trim() : "Episode";
        } else {
          title = pageTitle.replace("- Netflix", "").trim();
          unit = "Episode";
        }
      } else if (hostname.includes("hotstar.com") || hostname.includes("disneyplus.com")) {
        mediaType = "SHOW";
        const hsTitle = document.querySelector(".player-metadata-title, .title-field");
        title = hsTitle ? hsTitle.textContent.trim() : pageTitle.split(/[-–|]/)[0].trim();
        const hsSub = document.querySelector(".player-metadata-subtitle");
        unit = hsSub ? hsSub.textContent.trim() : "Episode";
      } else if (hostname.includes("primevideo.com")) {
        mediaType = "SHOW";
        const primeTitle = document.querySelector(".atvwebplayersdk-title-text");
        title = primeTitle ? primeTitle.textContent.trim() : pageTitle.split(/[-–|]/)[0].trim();
        const primeSub = document.querySelector(".atvwebplayersdk-subtitle-text");
        unit = primeSub ? primeSub.textContent.trim() : "Episode";
      } else {
        title = pageTitle.split(/[-–|]/)[0].trim();
        unit = "Episode";
      }

      if (title && video.currentTime > 0) {
        const timeStr = formatTime(video.currentTime);
        const resumeUrl = getResumeUrl(video.currentTime);

        chrome.runtime.sendMessage({
          type: "MEDIA_TELEMETRY",
          payload: {
            media_type: mediaType,
            series_title: title,
            unit_label: unit,
            timestamp_offset: timeStr,
            resume_url: resumeUrl
          }
        }).catch(() => {});
      }
    }

    // Attach event listeners to video elements dynamically
    function attachListeners() {
      const video = document.querySelector("video");
      if (video && !video.__daypilot_tracked) {
        video.__daypilot_tracked = true;
        video.addEventListener("pause", inspectVideo);
        video.addEventListener("seeked", inspectVideo);
      }
    }

    // Monitor video playback periodically
    setInterval(() => {
      attachListeners();
      const video = document.querySelector("video");
      if (video && !video.paused) {
        inspectVideo();
      }
    }, 6000);
  }
})();
