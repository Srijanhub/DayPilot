"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Tv, ArrowUpRight, Bookmark, RefreshCw } from "lucide-react";

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
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            LIVE SQLITE SYNC ({bookmarks.length})
          </span>
          <button onClick={fetchBookmarks} className="text-[var(--text-muted)] hover:text-white p-0.5">
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] font-mono">
          No manhwa or shows logged yet. Open Asura Scans, Flame Comics, or Netflix in Opera GX to track automatically.
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition group relative overflow-hidden"
            >
              {/* Top Tape Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] uppercase">
                  [{b.media_type}]
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {b.last_updated ? new Date(b.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently"}
                </span>
              </div>

              {/* Cartridge Title in Serif Italic */}
              <div className="quote-serif text-base font-semibold text-white group-hover:text-[var(--accent-primary)] transition mb-1">
                {b.title}
              </div>

              {/* Progress & Unit in Monospace */}
              <div className="flex items-center justify-between mt-2">
                <div className="font-mono text-xs text-[#f59e0b] font-bold">
                  {b.current_unit} {b.timestamp_offset ? `• ${b.timestamp_offset}` : ""}
                </div>
                {b.resume_url && (
                  <a
                    href={b.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-black border border-[var(--border-hairline)] text-[10px] font-mono font-bold tracking-wider transition flex items-center space-x-1"
                  >
                    <span>RESUME</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
