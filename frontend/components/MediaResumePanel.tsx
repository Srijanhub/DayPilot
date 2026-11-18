"use client";

import React from "react";
import { BookOpen, Tv, ArrowUpRight, Bookmark } from "lucide-react";

export default function MediaResumePanel() {
  const bookmarks = [
    {
      type: "MANHWA",
      title: "The Greatest Estate Developer",
      unit: "Chapter 148",
      progress: 88,
      site: "Asura Scans",
      url: "https://asuracomic.net",
      lastRead: "Yesterday, 11:45 PM"
    },
    {
      type: "MANHWA",
      title: "Solo Leveling: Ragnarok",
      unit: "Chapter 36",
      progress: 65,
      site: "Flame Comics",
      url: "https://flamecomics.me",
      lastRead: "Yesterday, 10:15 PM"
    },
    {
      type: "SHOW",
      title: "Arcane: Season 2",
      unit: "Episode 4 • 34:12",
      progress: 74,
      site: "Netflix",
      url: "https://netflix.com",
      lastRead: "2 days ago"
    }
  ];

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-[#f59e0b]" />
          <span className="instrument-label text-[#f59e0b] font-bold">
            MEDIA RADAR // CARTRIDGE RESUME
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">LEFT OFF AT</span>
      </div>

      <div className="space-y-3">
        {bookmarks.map((b, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition group relative overflow-hidden"
          >
            {/* Top Tape Header */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)] uppercase">
                [{b.type}] • {b.site}
              </span>
              <span className="text-[10px] font-mono text-slate-400">{b.lastRead}</span>
            </div>

            {/* Cartridge Title in Serif Italic */}
            <div className="quote-serif text-base font-semibold text-white group-hover:text-[var(--accent-primary)] transition mb-1">
              {b.title}
            </div>

            {/* Progress & Unit in Monospace */}
            <div className="flex items-center justify-between mt-2">
              <div className="font-mono text-xs text-[#f59e0b] font-bold">
                {b.unit}
              </div>
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-black border border-[var(--border-hairline)] text-[10px] font-mono font-bold tracking-wider transition flex items-center space-x-1"
              >
                <span>RESUME</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>

            {/* Micro Progress Bar */}
            <div className="w-full h-1 rounded-full bg-slate-800 mt-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                style={{ width: `${b.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
