"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Tv, Film, ArrowUpRight, Bookmark, RefreshCw, ExternalLink } from "lucide-react";

interface BookmarkItem {
  id: number;
  media_type: "MANHWA" | "MANGA" | "SHOW" | "ANIME";
  title: string;
  current_unit: string;
  timestamp_offset: string | null;
  resume_url: string;
  last_updated: string;
}

export default function MediaResumePanel() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    // Poll every 5 seconds to catch live updates from Opera GX extension
    const interval = setInterval(fetchBookmarks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResume = (url: string) => {
    if (!url) return;

    // 1. Browser-level open
    try {
      window.open(url, "_blank");
    } catch (e) {}

    // 2. Direct macOS Darwin launcher via local backend (100% reliable inside native app)
    fetch("http://127.0.0.1:4000/api/open-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }).catch(() => {});
  };

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-[#f59e0b]" />
          <span className="instrument-label text-[#f59e0b] font-bold">
            MEDIA RADAR // CARTRIDGE RESUME
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono text-[var(--text-muted)]">
            LIVE SQLITE SYNC ({bookmarks.length})
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

      {bookmarks.length === 0 ? (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] font-mono">
          No manhwa or shows logged yet. Open Asura Scans, Flame Comics, ToonGod, or Crunchyroll to track automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((b) => (
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
                  <span>[{b.media_type}]</span>
                </span>
                <span className="text-xs font-mono text-slate-400">
                  {b.last_updated ? new Date(b.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
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
                    <span>RESUME</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
