"use client";

import React, { useState, useEffect } from "react";
import { Activity, CheckCircle2, Clock } from "lucide-react";

export default function SpectrogramRibbon() {
  const [focusScore, setFocusScore] = useState<number>(88);
  const [flightLog, setFlightLog] = useState<any[]>([]);
  const [bars, setBars] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch nightly stats
    fetch("http://127.0.0.1:4000/api/briefing/nightly")
      .then((res) => res.json())
      .then((data) => {
        if (data.focus_score) setFocusScore(data.focus_score);
        if (data.flight_log) setFlightLog(data.flight_log);
      })
      .catch(() => {});

    // 2. Fetch live timeline for the 48 half-hour slots
    fetch("http://127.0.0.1:4000/api/timeline")
      .then((res) => res.json())
      .then((segments: any[]) => {
        const slotBars = Array.from({ length: 48 }).map((_, i) => {
          const slotHour = i / 2;
          let height = 15;
          let color = "oklch(1 0 0 / 0.08)";
          let category = "IDLE";

          for (const seg of segments) {
            if (slotHour >= seg.startHour && slotHour <= seg.endHour) {
              if (seg.category === "WORK") {
                height = 85;
                color = "oklch(0.85 0.18 200)";
                category = "WORK";
              } else if (seg.category === "STUDY") {
                height = 75;
                color = "oklch(0.74 0.18 155)";
                category = "STUDY";
              } else if (seg.category === "MANHWA") {
                height = 50;
                color = "oklch(0.68 0.21 15)";
                category = "MANHWA";
              } else if (seg.category === "SHOWS") {
                height = 60;
                color = "oklch(0.78 0.16 65)";
                category = "SHOWS";
              }
              break;
            }
          }

          return { slotHour, height, color, category };
        });
        setBars(slotBars);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="etched-panel rounded-xl p-5 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            24-HOUR CONTINUOUS SPECTROGRAM & RETROSPECTIVE
          </span>
        </div>
        <div className="flex items-center space-x-4 text-xs font-mono">
          <span className="text-[var(--text-muted)]">FOCUS SCORE:</span>
          <span className="text-sm font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/40">
            {focusScore} / 100
          </span>
        </div>
      </div>

      {/* Spectrogram Ribbon */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
          <span>00:00 (MIDNIGHT)</span>
          <span>12:00 (NOON)</span>
          <span>24:00 (NIGHT)</span>
        </div>
        <div className="h-16 w-full flex items-end gap-1 px-1 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] overflow-hidden">
          {bars.map((bar, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-all duration-300 hover:opacity-100 opacity-80"
              style={{
                height: `${bar.height}%`,
                backgroundColor: bar.color
              }}
              title={`Slot ${bar.slotHour}:00 • ${bar.category} (${bar.height}% intensity)`}
            />
          ))}
        </div>
        <div className="flex items-center justify-center space-x-6 text-[10px] font-mono text-[var(--text-muted)] pt-1">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00f5ff]" />
            <span>WORK</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>STUDY</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
            <span>MANHWA</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
            <span>SHOWS</span>
          </span>
        </div>
      </div>

      {/* Planned vs Completed Flight Log */}
      <div className="border-t border-[var(--border-hairline)] pt-3">
        <div className="instrument-label text-[9px] text-[var(--text-muted)] mb-2">
          PLANNED VS. COMPLETED FLIGHT LOG
        </div>
        <div className="space-y-2">
          {flightLog.map((item, idx) => {
            const isDone = item.status === "COMPLETED";
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs"
              >
                <div className="flex items-center space-x-2.5">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                  )}
                  <span className={`font-medium ${isDone ? "text-slate-200" : "text-amber-200"}`}>
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">{item.time}</span>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                    isDone
                      ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40"
                      : "bg-amber-950/60 text-amber-400 border border-amber-800/40"
                  }`}>
                    {isDone ? "RESOLVED" : "CARRIED OVER"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
