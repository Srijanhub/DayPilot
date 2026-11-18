"use client";

import React, { useState } from "react";
import { Sparkles, Clock, ExternalLink, Calendar, CheckCircle, RefreshCw } from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";

export default function MorningBriefingPanel() {
  const { briefing, fetchBriefing, isBriefingLoading } = useFlightDeckStore();
  const [showLiveCalendar, setShowLiveCalendar] = useState(false);

  return (
    <div className="etched-panel rounded-xl p-5 flex flex-col justify-between space-y-5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
            <span className="instrument-label text-[var(--accent-primary)] font-bold">
              09:00 AM IGNITION // MISSION PLAN
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowLiveCalendar(!showLiveCalendar)}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center space-x-1 ${
                showLiveCalendar
                  ? "bg-[var(--accent-primary)] text-black font-bold border-[var(--accent-primary)]"
                  : "text-[var(--text-muted)] hover:text-white border-[var(--border-hairline)]"
              }`}
            >
              <span>{showLiveCalendar ? "HIDE CALENDAR" : "LIVE CALENDAR"}</span>
            </button>
            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono text-[var(--text-muted)] hover:text-white flex items-center space-x-1 px-2 py-0.5 rounded border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] transition"
            >
              <span>PORTAL</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <button
              onClick={fetchBriefing}
              className="text-[var(--text-muted)] hover:text-white p-1"
              title="Refresh mission plan"
            >
              <RefreshCw className={`w-3 h-3 ${isBriefingLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Embedded Google Calendar View (Dark-HUD Filtered) */}
        {showLiveCalendar && (
          <div className="mb-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-elevated)] p-2 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] px-1">
              <span>SYNCED: onlinesrijanhalder@gmail.com (Asia/Kolkata)</span>
              <a
                href="https://calendar.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white flex items-center space-x-1 text-[var(--accent-primary)]"
              >
                <span>OPEN FULLSCREEN</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <iframe
              src="https://calendar.google.com/calendar/embed?src=onlinesrijanhalder%40gmail.com&ctz=Asia%2FKolkata"
              className="w-full h-72 rounded-lg border border-[var(--border-hairline)]"
              style={{
                filter: "invert(0.88) hue-rotate(180deg) contrast(1.1) brightness(0.85)"
              }}
              loading="lazy"
            />
          </div>
        )}

        {/* Priority Focus Directive */}
        <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] mb-4">
          <div className="text-[11px] font-mono text-[var(--accent-primary)] mb-1 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PRIMARY DIRECTIVE</span>
          </div>
          <div className="text-sm font-semibold text-white leading-relaxed">
            {briefing?.priority_focus || "Loading daily mission directive..."}
          </div>
        </div>

        {/* Planned Focus Blocks */}
        <div className="space-y-2">
          <div className="instrument-label text-[9px] text-[var(--text-muted)] mb-1">
            PLANNED FOCUS BLOCKS & DEADLINES (CLICK TO OPEN)
          </div>
          {(!briefing?.schedule_blocks || briefing.schedule_blocks.length === 0) ? (
            <div className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center font-mono text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>NO SCHEDULED CONFLICTS // OPEN AGENDA</span>
            </div>
          ) : (
            briefing.schedule_blocks.map((s, idx) => {
              const targetUrl = s.url || "https://calendar.google.com";

              return (
                <a
                  key={idx}
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] text-xs transition group cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5 truncate mr-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    <span className="font-mono text-[11px] text-[var(--accent-primary)] font-bold shrink-0">
                      {s.time}
                    </span>
                    <span className="text-white font-medium truncate group-hover:text-[var(--accent-primary)] transition">
                      {s.task}
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition text-[var(--accent-primary)] shrink-0" />
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                    {s.mode}
                  </span>
                </a>
              );
            })
          )}
        </div>
      </div>

      {/* Quote of the Day */}
      <div className="border-t border-[var(--border-hairline)] pt-3 text-center">
        <p className="quote-serif text-sm text-slate-300 italic">
          "{briefing?.morning_quote || "First, solve the problem. Then, write the code."}"
        </p>
        <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1 block">
          — {briefing?.morning_quote_author || "Anonymous"}
        </span>
      </div>
    </div>
  );
}
