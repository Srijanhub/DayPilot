"use client";

import React from "react";
import { Activity, ShieldCheck, ArrowRight, CheckCircle2, Clock } from "lucide-react";

export default function SpectrogramRibbon() {
  // 48 half-hour slots representing 24h spectrogram
  const bars = Array.from({ length: 48 }).map((_, i) => {
    const hour = i / 2;
    let height = 20;
    let color = "oklch(1 0 0 / 0.08)";
    let label = `${Math.floor(hour)}:00`;

    if (hour >= 9 && hour < 11.5) {
      height = 85;
      color = "oklch(0.85 0.18 200)"; // Work (Cyan)
    } else if (hour >= 11.5 && hour < 13) {
      height = 70;
      color = "oklch(0.74 0.18 155)"; // Study (Emerald)
    } else if (hour >= 13 && hour < 13.75) {
      height = 40;
      color = "oklch(0.68 0.21 15)";  // Manhwa (Rose)
    } else if (hour >= 14 && hour < 16.5) {
      height = 90;
      color = "oklch(0.85 0.18 200)"; // Work (Cyan)
    } else if (hour >= 16.5 && hour < 17.5) {
      height = 50;
      color = "oklch(0.78 0.16 65)";  // Shows (Amber)
    }

    return { hour, height, color, label };
  });

  const flightLog = [
    { title: "Dynamic Programming Lab 4 Submission", status: "COMPLETED", time: "11:20 AM" },
    { title: "Review GitHub PR #42 & Architecture", status: "COMPLETED", time: "02:40 PM" },
    { title: "YouTube DSA Playlist: Ep 16 Graph BFS", status: "CARRIED_OVER", time: "Tomorrow 09:00 AM" }
  ];

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
            88 / 100
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
              title={`Hour ${bar.label}: ${bar.height}% focus intensity`}
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
                    {item.status === "COMPLETED" ? "RESOLVED" : "CARRIED OVER"}
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
