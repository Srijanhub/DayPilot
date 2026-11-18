"use client";

import React, { useState, useEffect } from "react";
import { GraduationCap, GitPullRequest, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";

export default function BossCoderGitHubPanel() {
  const [bosscoderAlerts, setBosscoderAlerts] = useState<any[]>([]);
  const [githubPrs, setGithubPrs] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://127.0.0.1:4000/api/briefing/morning")
      .then((res) => res.json())
      .then((data) => {
        if (data.bosscoder_alerts) setBosscoderAlerts(data.bosscoder_alerts);
        if (data.github_notifications) setGithubPrs(data.github_notifications);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="etched-panel rounded-xl p-5 space-y-6">
      {/* BossCoder Academy Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-[#10b981]" />
            <span className="instrument-label text-[#10b981] font-bold">
              BOSSCODER ACADEMY // TASKS & LECTURES
            </span>
          </div>
          <a
            href="https://school.bosscoderacademy.com/home"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[var(--text-muted)] hover:text-white flex items-center space-x-1 px-2 py-0.5 rounded border border-[var(--border-hairline)] hover:border-emerald-500 transition"
          >
            <span>OPEN PORTAL</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {bosscoderAlerts.length === 0 ? (
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center font-mono text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>ALL TASKS CLEAR // NO PENDING ASSIGNMENTS AS SUCH</span>
          </div>
        ) : (
          <div className="space-y-2">
            {bosscoderAlerts.map((b, idx) => {
              const targetUrl = b.url || "https://school.bosscoderacademy.com/home";
              const isUrgent = b.urgency === "HIGH";

              return (
                <a
                  key={idx}
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[#10b981] transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="font-semibold text-white group-hover:text-[#10b981] transition flex items-center space-x-1.5">
                      <span>{b.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition text-[#10b981]" />
                    </div>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                        isUrgent
                          ? "bg-rose-950/60 text-rose-300 border-rose-800/40"
                          : "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Deadline: {b.deadline}</span>
                    <span className="text-[var(--text-muted)]">{b.type}</span>
                  </div>
                  {b.concern && (
                    <div className="mt-1.5 text-[10px] font-mono text-emerald-300/80 flex items-center space-x-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span>{b.concern}</span>
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* GitHub Notifications Section */}
      <div className="border-t border-[var(--border-hairline)] pt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <GitPullRequest className="w-4 h-4 text-[#00f5ff]" />
            <span className="instrument-label text-[#00f5ff] font-bold">
              GITHUB // NOTIFICATIONS & REVIEWS
            </span>
          </div>
          <a
            href="https://github.com/notifications"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[var(--text-muted)] hover:text-white flex items-center space-x-1 px-2 py-0.5 rounded border border-[var(--border-hairline)] hover:border-cyan-500 transition"
          >
            <span>NOTIFICATIONS</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>

        {githubPrs.length === 0 ? (
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center font-mono text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2">
            <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>ALL CLEAR // NO ACTIONABLE GITHUB NOTIFICATIONS</span>
          </div>
        ) : (
          <div className="space-y-2">
            {githubPrs.map((g, idx) => {
              const targetUrl = g.url || (g.pr ? `https://github.com/daypilot/pull/${g.pr.replace('#', '')}` : "https://github.com/notifications");

              return (
                <a
                  key={idx}
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[#00f5ff] transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center space-x-1.5 font-medium text-white truncate mr-2">
                      <span className="font-mono text-[#00f5ff] font-bold">{g.pr || "PR"}</span>
                      <span className="truncate group-hover:text-[#00f5ff] transition">{g.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition text-[#00f5ff] shrink-0" />
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 whitespace-nowrap">
                      {g.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>repo: {g.repo}</span>
                    <span>{g.author ? `by @${g.author}` : ""}</span>
                  </div>
                  {g.concern && (
                    <div className="mt-1.5 text-[10px] font-mono text-cyan-300/80 flex items-center space-x-1">
                      <AlertTriangle className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                      <span>{g.concern}</span>
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
