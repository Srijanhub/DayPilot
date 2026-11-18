"use client";

import React from "react";
import { Mail, ExternalLink, Sparkles, CheckCircle, RefreshCw, Clock, FileText } from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";

export default function GmailDigestPanel() {
  const { briefing, fetchBriefing, isBriefingLoading } = useFlightDeckStore();
  const emails = briefing?.priority_emails || [];

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center space-x-2">
          <Mail className="w-4 h-4 text-[#f59e0b]" />
          <span className="instrument-label text-[#f59e0b] font-bold">
            GMAIL INTELLIGENCE // EXECUTIVE INBOX SUMMARIES
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {emails.length} SUMMARIZED
          </span>
          <a
            href="https://mail.google.com/mail/u/0/#inbox"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-[#f59e0b] hover:text-black border border-[var(--border-hairline)] text-[10px] font-mono font-bold tracking-wider transition flex items-center space-x-1"
            title="Open Gmail Web in Opera GX"
          >
            <span>INBOX</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button
            onClick={fetchBriefing}
            className="text-[var(--text-muted)] hover:text-white p-1"
            title="Refresh inbox summaries"
          >
            <RefreshCw className={`w-3 h-3 ${isBriefingLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Subtitle */}
      <div className="text-[11px] font-mono text-[var(--text-muted)]">
        AI-extracted content summaries of your latest unread emails. Click any card to launch the conversation in Gmail.
      </div>

      {/* Email List or Empty State */}
      {emails.length === 0 ? (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center font-mono text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>INBOX ZERO // ALL EMAILS FULLY REVIEWED</span>
        </div>
      ) : (
        <div className="space-y-3">
          {emails.map((e) => {
            const targetUrl = e.url || `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(e.from || e.subject)}`;
            const isHigh = e.priority === "HIGH" || e.priority === "CRITICAL";
            const summaryText = e.summary || e.concern || e.snippet || "No preview available.";

            return (
              <a
                key={e.id}
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-4 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[#f59e0b] transition group cursor-pointer relative overflow-hidden space-y-2.5"
              >
                {/* Top Sender & Time Row */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-white group-hover:text-[#f59e0b] transition">
                      {e.from}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                        isHigh
                          ? "bg-rose-950/60 text-rose-300 border-rose-800/40 font-bold"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {e.priority}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{e.time}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-[#f59e0b]" />
                  </div>
                </div>

                {/* Email Subject */}
                <div className="text-xs font-bold text-slate-100 line-clamp-1">
                  {e.subject}
                </div>

                {/* Full Executive Summary Box */}
                <div className="p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-hairline)] text-xs text-slate-300 leading-relaxed space-y-1">
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono text-[#f59e0b] uppercase font-bold tracking-wider">
                    <Sparkles className="w-3 h-3 text-[#f59e0b]" />
                    <span>EXECUTIVE SUMMARY</span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans">
                    {summaryText}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
