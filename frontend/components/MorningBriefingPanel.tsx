"use client";

import React from "react";
import { Sparkles, Calendar, Mail, CheckCircle2, Clock } from "lucide-react";

export default function MorningBriefingPanel() {
  const schedule = [
    { time: "10:00 - 11:30 AM", title: "BossCoder: Dynamic Programming Lab 4", type: "STUDY", urgent: true },
    { time: "02:00 - 02:45 PM", title: "GitHub: Review & Merge Auth Refactor PR #42", type: "WORK", urgent: false },
    { time: "08:00 - 09:30 PM", title: "BossCoder Live Lecture: Graph Theory & BFS/DFS", type: "STUDY", urgent: true },
  ];

  const emails = [
    { from: "BossCoder Mentor", subject: "Review feedback on Binary Search Trees Lab", time: "08:15 AM" },
    { from: "GitHub Notification", subject: "[daypilot] 2 new PR review requests assigned", time: "07:40 AM" }
  ];

  return (
    <div className="etched-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            09:00 AM IGNITION // MISSION PLAN
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">TODAY'S TARGET</span>
        </div>

        {/* Priority Focus Card */}
        <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] mb-4">
          <div className="text-[11px] font-mono text-[var(--accent-primary)] mb-1 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PRIMARY DIRECTIVE</span>
          </div>
          <div className="text-sm font-semibold text-white">
            Complete BossCoder DP Lab 4 & verify tree edge cases before 4:00 PM.
          </div>
        </div>

        {/* Schedule Timeline */}
        <div className="space-y-2 mb-4">
          <div className="instrument-label text-[9px] text-[var(--text-muted)] mb-1.5">
            PLANNED FOCUS BLOCKS
          </div>
          {schedule.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="font-mono text-[11px] text-[var(--accent-primary)]">{s.time}</span>
                <span className="text-white font-medium truncate max-w-[190px]">{s.title}</span>
              </div>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                s.urgent ? "bg-amber-950/60 text-amber-400 border border-amber-800/40" : "bg-slate-800 text-slate-400"
              }`}>
                {s.type}
              </span>
            </div>
          ))}
        </div>

        {/* Priority Emails */}
        <div className="space-y-1.5">
          <div className="instrument-label text-[9px] text-[var(--text-muted)] mb-1">
            GMAIL PRIORITY DIGEST
          </div>
          {emails.map((e, idx) => (
            <div key={idx} className="flex items-start justify-between text-xs p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
              <div className="truncate mr-2">
                <div className="text-[11px] font-medium text-slate-200">{e.from}</div>
                <div className="text-[10px] text-slate-400 truncate">{e.subject}</div>
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)] whitespace-nowrap">{e.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quote of the Day (Editorial Serif Italic) */}
      <div className="border-t border-[var(--border-hairline)] pt-3 text-center">
        <p className="quote-serif text-sm text-slate-300">
          "The secret of getting ahead is getting started."
        </p>
        <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1 block">
          — Mark Twain
        </span>
      </div>
    </div>
  );
}
