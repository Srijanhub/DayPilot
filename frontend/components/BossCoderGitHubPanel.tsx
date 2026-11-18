"use client";

import React from "react";
import { GraduationCap, GitPullRequest, GitMerge, AlertCircle, ExternalLink } from "lucide-react";

export default function BossCoderGitHubPanel() {
  const bosscoderAlerts = [
    { title: "Dynamic Programming Lab 4", deadline: "Today, 4:00 PM", status: "PENDING SUBMISSION" },
    { title: "Live Mentorship Session", deadline: "8:00 PM - 9:30 PM", status: "STARTS IN 9H" },
    { title: "Weekly Contest #28", deadline: "Saturday, 7:00 PM", status: "UPCOMING" }
  ];

  const githubPrs = [
    { repo: "daypilot", pr: "#42", title: "feat: add simplex noise 3D orb", author: "srijanhalder", status: "REVIEW REQUESTED" },
    { repo: "backend-engine", pr: "#18", title: "fix: 120s hysteresis debounce classifier", author: "teammate", status: "APPROVED" }
  ];

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      {/* BossCoder Academy Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-[#10b981]" />
            <span className="instrument-label text-[#10b981] font-bold">
              BOSSCODER ACADEMY
            </span>
          </div>
          <a
            href="https://school.bosscoderacademy.com/home"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[var(--text-muted)] hover:text-white flex items-center space-x-1"
          >
            <span>PORTAL</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        <div className="space-y-2">
          {bosscoderAlerts.map((b, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between text-xs"
            >
              <div>
                <div className="font-semibold text-white">{b.title}</div>
                <div className="text-[10px] font-mono text-slate-400">{b.deadline}</div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                {b.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* GitHub Notifications Section */}
      <div className="border-t border-[var(--border-hairline)] pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <GitPullRequest className="w-4 h-4 text-[#00f5ff]" />
            <span className="instrument-label text-[#00f5ff] font-bold">
              GITHUB NOTIFICATIONS
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">2 ACTIONABLE</span>
        </div>

        <div className="space-y-2">
          {githubPrs.map((g, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-between text-xs"
            >
              <div className="truncate mr-2">
                <div className="flex items-center space-x-1.5 font-medium text-white truncate">
                  <span className="font-mono text-[#00f5ff]">{g.pr}</span>
                  <span className="truncate">{g.title}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">repo: {g.repo}</div>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 whitespace-nowrap">
                {g.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
