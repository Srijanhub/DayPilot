"use client";

import React from "react";
import { Newspaper, ExternalLink, ArrowRight } from "lucide-react";

export default function NewspaperPanel() {
  const newsItems = [
    {
      topic: "AI / RESEARCH",
      headline: "Google DeepMind releases high-efficiency reasoning models cutting inference latency by 40%.",
      source: "ArXiv / TechCrunch",
      url: "https://news.ycombinator.com"
    },
    {
      topic: "DEV / ARCHITECTURE",
      headline: "Local-first SQLite with WAL mode becomes standard for low-latency desktop agent copilots.",
      source: "DEV Community",
      url: "https://dev.to"
    },
    {
      topic: "CAMPUS / TECH",
      headline: "BossCoder announces dynamic graph contest with live mentorship evaluations this weekend.",
      source: "BossCoder Daily",
      url: "https://school.bosscoderacademy.com/home"
    }
  ];

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Newspaper className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            MORNING NEWSPAPER // EXECUTIVE DIGEST
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">3 BULLETS</span>
      </div>

      <div className="space-y-2.5">
        {newsItems.map((n, idx) => (
          <a
            key={idx}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-mono tracking-widest text-[var(--accent-primary)] font-bold">
                {n.topic}
              </span>
              <span className="text-[9px] font-mono text-[var(--text-muted)] flex items-center space-x-1 group-hover:text-white transition">
                <span>{n.source}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed group-hover:text-white transition">
              {n.headline}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
