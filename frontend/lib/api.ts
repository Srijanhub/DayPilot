/**
 * DayPilot Centralized Typed API Client
 * Provides unified access to the FastAPI backend on 127.0.0.1:4000
 * with token authentication and error handling.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_DAYPILOT_API_URL || "http://127.0.0.1:4000";

export const WS_BASE =
  process.env.NEXT_PUBLIC_DAYPILOT_WS_URL || "ws://127.0.0.1:4000";

let cachedToken: string | null = process.env.NEXT_PUBLIC_DAYPILOT_API_TOKEN || null;

export async function getActiveToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/token");
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          cachedToken = data.token;
          return cachedToken as string;
        }
      }
    } catch (e) {}
  }
  return "";
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("X-DayPilot-Token")) {
    const token = await getActiveToken();
    if (token) {
      headers.set("X-DayPilot-Token", token);
    }
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`API error [${response.status}] on ${path}: ${response.statusText}`);
  }

  return response.json();
}

export interface ScheduleBlock {
  time: string;
  task: string;
  mode: "WORK" | "STUDY" | "RELAX";
  url?: string | null;
}

export interface MorningBriefing {
  morning_quote: string;
  morning_quote_author: string;
  priority_focus: string;
  schedule_blocks: ScheduleBlock[];
  newspaper_digest: Array<{ category: string; headline: string; source: string; time: string; url?: string }>;
  bosscoder_alerts: Array<any>;
  github_notifications: Array<any>;
  github_prs?: Array<any>;
  calendar_events: Array<any>;
  priority_emails: Array<any>;
}

export interface MediaBookmark {
  id: number;
  media_type: "MANHWA" | "MANGA" | "SHOW" | "ANIME";
  title: string;
  current_unit: string;
  timestamp_offset: string | null;
  resume_url: string;
  last_updated: string;
}

export interface VoiceMemo {
  id: number;
  time: string;
  text: string;
  action: string;
  duration: number;
}

export interface LiveTabInfo {
  is_active: boolean;
  app_name?: string;
  window_title?: string;
  domain?: string;
  url?: string;
  category?: string;
  dwell_seconds?: number;
  last_heartbeat?: string;
}

export interface OpenTab {
  id: number;
  window_id?: number | null;
  title: string;
  url: string;
  domain: string;
  active: boolean;
  focused: boolean;
  category: string;
}
export interface OpenTabsState {
  connected: boolean;
  tabs: OpenTab[];
  updated_at?: number;
}
export interface TabHistoryItem {
  title: string;
  domain: string;
  url: string;
  category: string;
  total_seconds: number;
  formatted_time: string;
  last_active: string;
}

export interface FlightLogItem {
  title: string;
  type?: "PLANNED" | "CALENDAR" | "UNPLANNED" | "LEISURE";
  time: string;
  status: "COMPLETED" | "PARTIAL" | "CARRIED OVER" | "LEISURE";
  logged_duration?: string;
  logged_seconds?: number;
}

export interface SpectrogramSlot {
  slot: number;
  time: string;
  time_range: string;
  category: "WORK" | "STUDY" | "MANHWA" | "SHOWS" | "RELAX" | "LEISURE" | "IDLE";
  intensity: number;
  height: number;
  color: string;
  active_seconds: number;
  active_minutes: number;
  idle_minutes: number;
  top_app: string;
  category_breakdown?: Record<string, number>;
}

export interface NightlyBriefing {
  date: string;
  focus_score: number;
  is_demo_data: boolean;
  total_work_seconds: number;
  total_relax_seconds: number;
  total_work_hours?: number;
  total_relax_hours?: number;
  category_totals: Record<string, number>;
  bookmarks: MediaBookmark[];
  flight_log: FlightLogItem[];
  spectrogram?: SpectrogramSlot[];
  ai_summary: string;
}

export interface TimelineSegment {
  startHour: number;
  endHour: number;
  category: "WORK" | "STUDY" | "MANHWA" | "SHOWS";
  label: string;
  duration: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  topic: string;
  url: string;
  discussion_url?: string | null;
  published: string;
  published_ts: number;
  is_new: boolean;
}
export interface NewsFeedStatus {
  name: string;
  topic: string;
  ok: boolean;
  count: number;
  error?: string | null;
  not_modified?: boolean;
}
export interface NewsPayload {
  articles: NewsArticle[];
  topics: Record<string, number>;
  fetched_at: number | null;
  stale: boolean;
  feeds: NewsFeedStatus[];
  configured_feeds: number;
}

export const daypilotApi = {
  getNews: (topic?: string) =>
    apiFetch<NewsPayload>(`/api/news${topic ? `?topic=${encodeURIComponent(topic)}` : ""}`),
  refreshNews: () => apiFetch<NewsPayload>("/api/news/refresh", { method: "POST" }),
  getMorningBriefing: () => apiFetch<MorningBriefing>("/api/briefing/morning"),
  getNightlyBriefing: () => apiFetch<NightlyBriefing>("/api/briefing/nightly"),
  getSpectrogram: () => apiFetch<SpectrogramSlot[]>("/api/spectrogram"),
  getTimeline: () => apiFetch<TimelineSegment[]>("/api/timeline"),
  getBookmarks: () => apiFetch<MediaBookmark[]>("/api/bookmarks"),
  getMemos: () => apiFetch<VoiceMemo[]>("/api/memos"),
  getLiveTab: () => apiFetch<LiveTabInfo>("/api/tabs/live"),
  getOpenTabs: () => apiFetch<OpenTabsState>("/api/tabs/open"),
  getTabHistory: () => apiFetch<TabHistoryItem[]>("/api/tabs/history"),
  getMusicSuggestion: () => apiFetch<any>("/api/music/suggest"),
  syncAll: () => apiFetch<any>("/api/sync/all", { method: "POST" }),
  syncHistory: () => apiFetch<any>("/api/bookmarks/sync-history", { method: "POST" }),
  
  openUrl: (url: string) =>
    apiFetch<{ status: string; url: string; browser: string }>("/api/open-url", {
      method: "POST",
      body: JSON.stringify({ url })
    }),

  activateTab: (tabId: number, windowId?: number | null, url?: string) =>
    apiFetch<{ status: string; tab_id: number }>("/api/tabs/activate", {
      method: "POST",
      body: JSON.stringify({ tab_id: tabId, window_id: windowId, url })
    }),

  uploadMemo: (formData: FormData) =>
    apiFetch<any>("/api/memos/upload", {
      method: "POST",
      body: formData
    }),

  chat: (message: string, history: Array<{ role: string; content: string }> = []) =>
    apiFetch<{ reply: string; mode: string; active_tab: string; source: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message, history })
    }),

  setOverride: (mode: string) =>
    apiFetch<any>("/api/context/override", {
      method: "POST",
      body: JSON.stringify({ mode })
    })
};
