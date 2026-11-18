"use client";

import React, { useState, useEffect } from "react";
import { Mail, ExternalLink, AlertCircle, CheckCircle, RefreshCw, Clock } from "lucide-react";

interface PriorityEmail {
  id: string;
  from: string;
  subject: string;
  snippet?: string;
  time: string;
  priority: string;
  concern?: string;
  url?: string;
}

export default function GmailDigestPanel() {
  const [emails, setEmails] = useState<PriorityEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmails = () => {
    setLoading(true);
    fetch("http://127.0.0.1:4000/api/briefing/morning")
      .then((res) => res.json())
      .then((data) => {
        if (data.priority_emails) {
          setEmails(data.priority_emails);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mail className="w-4 h-4 text-[#f59e0b]" />
          <span className="instrument-label text-[#f59e0b] font-bold">
            GMAIL DIGEST // ACTIONABLE INBOX
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {emails.length} ACTIONABLE
          </span>
          <a
            href="https://mail.google.com/mail/u/0/#inbox"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-black border border-[var(--border-hairline)] text-[10px] font-mono font-bold tracking-wider transition flex items-center space-x-1"
            title="Open Gmail Web in Opera GX"
          >
            <span>OPEN GMAIL</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
          <button
            onClick={fetchEmails}
            className="text-[var(--text-muted)] hover:text-white p-1"
            title="Refresh inbox digest"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Subheader / Micro-label */}
      <div className="text-[11px] font-mono text-[var(--text-muted)]">
        High-priority emails requiring your attention or response today. Click any card to launch the thread in Gmail.
      </div>

      {/* Email List or Empty State */}
      {emails.length === 0 ? (
        <div className="p-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-center font-mono text-xs text-[var(--text-muted)] flex items-center justify-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>INBOX ZERO // NO UNREAD NOTIFICATIONS OR EMAILS PENDING</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          {emails.map((e) => {
            const targetUrl = e.url || `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(e.from || e.subject)}`;
            const isHigh = e.priority === "HIGH" || e.priority === "CRITICAL";

            return (
              <a
                key={e.id}
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3.5 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[#f59e0b] transition group cursor-pointer relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white group-hover:text-[#f59e0b] transition">
                      {e.from}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                        isHigh
                          ? "bg-rose-950/60 text-rose-300 border-rose-800/40"
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

                <div className="text-xs font-medium text-slate-200 mb-1 line-clamp-1">
                  {e.subject}
                </div>

                {e.concern && (
                  <div className="mt-2 text-[11px] font-mono px-2.5 py-1 rounded bg-[var(--bg-base)] border border-[var(--border-hairline)] text-amber-300 flex items-center space-x-1.5">
                    <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                    <span className="truncate">{e.concern}</span>
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
