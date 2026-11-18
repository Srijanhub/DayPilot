"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Clock, RefreshCw } from "lucide-react";

interface BriefingData {
  morning_quote: string;
  morning_quote_author: string;
  priority_focus: string;
  schedule_blocks: Array<{ time: string; task: string; mode: string }>;
  priority_emails: Array<{ from: string; subject: string; time: string; priority: string }>;
}

export default function MorningBriefingPanel() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:4000/api/briefing/morning")
      .then((res) => res.json())
      .then((data) => setBriefing(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="etched-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            09:00 AM IGNITION // MISSION PLAN
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">LIVE SYNTHESIS</span>
        </div>

        {/* Priority Focus Directive */}
        <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] mb-4">
          <div className="text-[11px] font-mono text-[var(--accent-primary)] mb-1 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PRIMARY DIRECTIVE</span>
          </div>
          <div className="text-sm font-semibold text-white">
            {briefing?.priority_focus || "Loading daily mission directive..."}
          </div>
        </div>

        {/* Schedule Blocks */}
        <div className="space-y-2 mb-4">
          <div className="instrument-label text-[9px] text-[var(--text-muted)] mb-1.5">
            PLANNED FOCUS BLOCKS
          </div>
          {briefing?.schedule_blocks?.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs"
            >
              <div className="flex items-center space-x-2.5">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span className="font-mono text-[11px] text-[var(--accent-primary)]">{s.time}</span>
                <span className="text-white font-medium truncate max-w-[190px]">{s.task}</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {s.mode}
              </span>
            </div>
          ))}
        </div>

        {/* Priority Emails */}
        <div className="space-y-1.5">
          <div className="instrument-label text-[9px] text-[var(--text-muted)] mb-1">
            GMAIL PRIORITY DIGEST
          </div>
          {briefing?.priority_emails?.map((e, idx) => (
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

      {/* Quote of the Day */}
      <div className="border-t border-[var(--border-hairline)] pt-3 text-center">
        <p className="quote-serif text-sm text-slate-300">
          "{briefing?.morning_quote || "First, solve the problem. Then, write the code."}"
        </p>
        <span className="text-[10px] font-mono text-[var(--text-muted)] mt-1 block">
          — {briefing?.morning_quote_author || "Anonymous"}
        </span>
      </div>
    </div>
  );
}
