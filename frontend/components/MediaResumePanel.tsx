"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Tv, Film, ArrowUpRight, Bookmark, RefreshCw, ChevronDown, Layers } from "lucide-react";

interface BookmarkItem {
  id: number;
  media_type: "MANHWA" | "MANGA" | "SHOW" | "ANIME";
  title: string;
  current_unit: string;
  timestamp_offset: string | null;
  resume_url: string;
  last_updated: string;
}

type CategoryTab = "ALL" | "SHOWS" | "COMICS";

export default function MediaResumePanel() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CategoryTab>("ALL");
  const [visibleCount, setVisibleCount] = useState<number>(5);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch("http://127.0.0.1:4000/api/bookmarks");
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data);
      }
    } catch (err) {
      // Backend offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
    // Poll every 5 seconds to catch live updates from Opera GX
    const interval = setInterval(fetchBookmarks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResume = (url: string) => {
    if (!url) return;

    // 1. Browser-level open
    try {
      window.open(url, "_blank");
    } catch (e) {}

    // 2. Direct macOS Darwin launcher targeting Opera GX
    fetch("http://127.0.0.1:4000/api/open-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }).catch(() => {});
  };

  const handleTabChange = (tab: CategoryTab) => {
    setActiveTab(tab);
    setVisibleCount(5); // Reset to top 5 when switching categories
  };

  // Split into categories
  const showsList = bookmarks.filter(
    (b) => b.media_type === "SHOW" || b.media_type === "ANIME"
  );
  const comicsList = bookmarks.filter(
    (b) => b.media_type === "MANHWA" || b.media_type === "MANGA"
  );

  const currentList =
    activeTab === "SHOWS"
      ? showsList
      : activeTab === "COMICS"
      ? comicsList
      : bookmarks;

  const displayedList = currentList.slice(0, visibleCount);
  const hasMore = visibleCount < currentList.length;
  const remainingCount = currentList.length - visibleCount;

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-[#f59e0b]" />
          <span className="instrument-label text-[#f59e0b] font-bold">
            MEDIA RADAR // CARTRIDGE RESUME
          </span>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            OPERA GX SYNC ({bookmarks.length})
          </span>
          <button
            onClick={fetchBookmarks}
            className="text-[var(--text-muted)] hover:text-white p-1 rounded hover:bg-[var(--bg-elevated)] transition"
            title="Refresh Bookmarks"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Category Tab Switcher: ALL, SHOWS, COMICS */}
      <div className="flex items-center space-x-1.5 p-1 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border-hairline)] text-xs font-mono shadow-inner">
        <button
          onClick={() => handleTabChange("ALL")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-1.5 ${
            activeTab === "ALL"
              ? "bg-[#f59e0b] text-black font-bold shadow-sm"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>ALL ({bookmarks.length})</span>
        </button>

        <button
          onClick={() => handleTabChange("SHOWS")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-1.5 ${
            activeTab === "SHOWS"
              ? "bg-[#f59e0b] text-black font-bold shadow-sm"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>SHOWS ({showsList.length})</span>
        </button>

        <button
          onClick={() => handleTabChange("COMICS")}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-1.5 ${
            activeTab === "COMICS"
              ? "bg-[#f59e0b] text-black font-bold shadow-sm"
              : "text-[var(--text-muted)] hover:text-white"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>COMICS ({comicsList.length})</span>
        </button>
      </div>

      {/* Cartridge List */}
      {displayedList.length === 0 ? (
        <div className="p-6 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] font-mono">
          {activeTab === "SHOWS"
            ? "No anime, TV shows, or YouTube series logged yet in Opera GX."
            : activeTab === "COMICS"
            ? "No manhwa or webtoon chapters logged yet in Opera GX."
            : "No media bookmarks recorded yet in Opera GX."}
        </div>
      ) : (
        <div className="space-y-3">
          {displayedList.map((b) => (
            <div
              key={b.id}
              onClick={() => handleResume(b.resume_url)}
              className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[#f59e0b]/50 transition-all duration-300 group relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md"
            >
              {/* Top Tape Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono tracking-widest text-[#f59e0b] font-semibold uppercase flex items-center space-x-1.5">
                  {b.media_type === "MANHWA" || b.media_type === "MANGA" ? (
                    <BookOpen className="w-3.5 h-3.5" />
                  ) : b.media_type === "ANIME" ? (
                    <Film className="w-3.5 h-3.5" />
                  ) : (
                    <Tv className="w-3.5 h-3.5" />
                  )}
                  <span>
                    [{b.media_type === "MANHWA" || b.media_type === "MANGA" ? "COMIC" : b.media_type}]
                  </span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {b.last_updated
                    ? new Date(b.last_updated).toLocaleDateString([], { month: "short", day: "numeric" }) +
                      " " +
                      new Date(b.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "Recently"}
                </span>
              </div>

              {/* Cartridge Title in Serif Italic */}
              <div className="quote-serif text-lg font-semibold text-white group-hover:text-[var(--accent-primary)] transition mb-1">
                {b.title}
              </div>

              {/* Progress & Unit in Monospace */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--border-hairline)]">
                <div className="font-mono text-xs text-[#f59e0b] font-bold">
                  {b.current_unit} {b.timestamp_offset ? `• ${b.timestamp_offset}` : ""}
                </div>
                {b.resume_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResume(b.resume_url);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-surface)] group-hover:bg-[#f59e0b] group-hover:text-black border border-[var(--border-hairline)] group-hover:border-[#f59e0b] text-xs font-mono font-bold tracking-wider transition-all flex items-center space-x-1.5 shadow-sm"
                  >
                    <span>RESUME IN OPERA GX</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Show More Button (loads 10 more each time) */}
          {hasMore && (
            <div className="pt-2">
              <button
                onClick={() => setVisibleCount((prev) => prev + 10)}
                className="w-full py-2.5 px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[#f59e0b]/15 border border-[var(--border-hairline)] hover:border-[#f59e0b]/50 text-xs font-mono font-bold text-[var(--text-muted)] hover:text-[#f59e0b] transition-all duration-200 flex items-center justify-center space-x-2 group shadow-sm"
              >
                <span>SHOW MORE (+{Math.min(10, remainingCount)})</span>
                <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition" />
                <span className="text-[10px] text-slate-500 font-normal">
                  (Showing {displayedList.length} of {currentList.length})
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
