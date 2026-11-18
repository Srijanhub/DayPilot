"use client";

import React, { useEffect, useState } from "react";
import { Newspaper, ExternalLink, RefreshCw, MessageSquare } from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";

// Feed links are untrusted input: only ever render http(s) URLs.
const safeUrl = (u?: string | null) => (u && /^https?:\/\//i.test(u) ? u : undefined);

function timeAgo(ts: number, nowMs: number): string {
  if (!nowMs) return "recently";
  const mins = Math.max(0, Math.floor((nowMs / 1000 - ts) / 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
}

export default function NewspaperPanel() {
  const { news, isNewsRefreshing, refreshNews, loadNews } = useFlightDeckStore();
  const [topic, setTopic] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(0);

  // Load the cached digest on mount; the WebSocket pushes updates after that
  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Keep "5m ago" labels honest without hitting the backend
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const articles = (news?.articles ?? []).filter((a) => topic === "ALL" || a.topic === topic);
  const topics = ["ALL", ...Object.keys(news?.topics ?? {})];
  const okFeeds = news?.feeds.filter((f) => f.ok).length ?? 0;
  const failedFeeds = news?.feeds.filter((f) => !f.ok) ?? [];
  const [lead, ...rest] = articles;

  const renderMeta = (a: NonNullable<typeof lead>) => (
    <div className="flex items-center flex-wrap gap-x-2 text-xs font-mono text-[var(--text-muted)]">
      <span className="text-[var(--accent-primary)] font-bold tracking-widest">{a.topic}</span>
      <span>{a.source}</span>
      <span>•</span>
      <span>{timeAgo(a.published_ts, nowMs)}</span>
      {a.is_new && (
        <span className="px-1.5 rounded bg-[var(--accent-glow)] text-[var(--accent-primary)] border border-[var(--accent-ring)] font-bold">
          NEW
        </span>
      )}
    </div>
  );

  const renderLinks = (a: NonNullable<typeof lead>) => (
    <div className="flex items-center gap-4 mt-2 text-xs font-mono">
      {safeUrl(a.url) && (
        <a href={safeUrl(a.url)} target="_blank" rel="noopener noreferrer"
           className="flex items-center space-x-1 text-[var(--accent-primary)] hover:underline">
          <span>READ ARTICLE</span><ExternalLink className="w-3 h-3" />
        </a>
      )}
      {safeUrl(a.discussion_url) && (
        <a href={safeUrl(a.discussion_url)} target="_blank" rel="noopener noreferrer"
           className="flex items-center space-x-1 text-[var(--text-muted)] hover:text-white">
          <MessageSquare className="w-3 h-3" /><span>DISCUSSION</span>
        </a>
      )}
    </div>
  );

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Newspaper className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="instrument-label text-[var(--accent-primary)] font-bold">LIVE NEWSPAPER</span>
        </div>
        <button
          onClick={() => refreshNews()}
          disabled={isNewsRefreshing}
          aria-label="Refresh news"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] text-xs font-mono text-[var(--text-secondary)] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isNewsRefreshing ? "animate-spin" : ""}`} />
          <span>{isNewsRefreshing ? "FETCHING" : "REFRESH"}</span>
        </button>
      </div>

      {news && (
        <div className="text-xs font-mono text-[var(--text-muted)]">
          {news.fetched_at ? `Updated ${timeAgo(news.fetched_at, nowMs)}` : "Never updated"}
          {news.feeds.length > 0 && ` • ${okFeeds}/${news.feeds.length} sources reachable`}
          {news.stale && <span className="text-amber-400"> • may be out of date</span>}
        </div>
      )}

      {topics.length > 2 && (
        <div className="flex flex-wrap gap-1 text-xs font-mono">
          {topics.map((t) => (
            <button key={t} onClick={() => setTopic(t)}
              className={`px-2.5 py-1 rounded transition ${topic === t ? "bg-[var(--accent-primary)] text-black font-bold" : "text-[var(--text-muted)] hover:text-white bg-[var(--bg-elevated)]"}`}>
              {t}{t !== "ALL" && news ? ` ${news.topics[t]}` : ""}
            </button>
          ))}
        </div>
      )}

      {!news ? (
        <div className="p-4 text-center text-xs font-mono text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-lg">
          Loading headlines…
        </div>
      ) : articles.length === 0 ? (
        <div className="p-4 text-center text-xs font-mono text-[var(--text-muted)] border border-dashed border-[var(--border-hairline)] rounded-lg space-y-1">
          <div>No recent headlines yet. Press REFRESH, or check your internet connection.</div>
          {failedFeeds.slice(0, 3).map((f) => (
            <div key={f.name} className="text-amber-400">{f.name}: {f.error}</div>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {lead && (
            <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)] space-y-2">
              {renderMeta(lead)}
              <h3 className="text-sm font-bold text-white leading-snug">{lead.title}</h3>
              {lead.summary && <p className="text-xs text-slate-300 leading-relaxed">{lead.summary}</p>}
              {renderLinks(lead)}
            </div>
          )}
          {rest.map((a) => {
            const open = expanded === a.id;
            return (
              <div key={a.id} className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] transition">
                {renderMeta(a)}
                <button onClick={() => setExpanded(open ? null : a.id)} className="text-left w-full mt-1" aria-expanded={open}>
                  <span className="block text-xs font-semibold text-slate-200 leading-relaxed">{a.title}</span>
                </button>
                {open && (
                  <div className="mt-1.5">
                    {a.summary && <p className="text-xs text-slate-400 leading-relaxed">{a.summary}</p>}
                    {renderLinks(a)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
