import { create } from "zustand";
import { TimelineSegment } from "@/components/DialRing";
import type { NewsPayload, TabHistoryItem } from "@/lib/api";
import {
  daypilotApi,
  MorningBriefing,
  MediaBookmark,
  VoiceMemo,
  LiveTabInfo,
  OpenTab,
  NightlyBriefing
} from "@/lib/api";

export type FlightMode = "WORK" | "STUDY" | "RELAX";
export type OverrideMode = "AUTO" | "FORCE_WORK" | "FORCE_STUDY" | "FORCE_RELAX";

interface FlightDeckState {
  mode: FlightMode;
  override: OverrideMode;
  isPhaseShifting: boolean;
  audioEnergy: number;
  isCommandPaletteOpen: boolean;
  isBootComplete: boolean;

  // Cached Telemetry Stores (Centralized to eliminate redundant polling)
  timelineSegments: TimelineSegment[];
  briefing: MorningBriefing | null;
  bookmarks: MediaBookmark[];
  memos: VoiceMemo[];
  liveTab: LiveTabInfo | null;
  openTabs: OpenTab[];
  tabHistory: TabHistoryItem[];
  browserConnected: boolean;
  nightlyBriefing: NightlyBriefing | null;
  isBriefingLoading: boolean;
  isBookmarksLoading: boolean;
  news: NewsPayload | null;
  isNewsRefreshing: boolean;

  // Actions
  setMode: (mode: FlightMode) => void;
  setOverride: (override: OverrideMode) => void;
  setAudioEnergy: (energy: number) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  completeBoot: () => void;
  setTimelineSegments: (segments: TimelineSegment[]) => void;
  triggerPhaseShift: (newMode: FlightMode) => void;

  // Cache Fetchers & Event-driven invalidators
  loadInitialData: () => Promise<void>;
  fetchBriefing: () => Promise<void>;
  fetchBookmarks: () => Promise<void>;
  refreshBriefing: () => Promise<void>;
  refreshBookmarks: () => Promise<void>;
  refreshLiveTab: () => Promise<void>;
  refreshTabHistory: () => Promise<void>;
  refreshTimeline: () => Promise<void>;
  refreshMemos: () => Promise<void>;
  refreshNightlyBriefing: () => Promise<void>;
  loadNews: () => Promise<void>;
  refreshNews: () => Promise<void>;
  handleWebSocketMessage: (payload: any, data?: any) => void;
}

export const useFlightDeckStore = create<FlightDeckState>((set, get) => ({
  mode: "WORK",
  override: "AUTO",
  isPhaseShifting: false,
  audioEnergy: 0.0,
  isCommandPaletteOpen: false,
  isBootComplete: false,

  timelineSegments: [],
  briefing: null,
  bookmarks: [],
  memos: [],
  liveTab: null,
  openTabs: [],
  tabHistory: [],
  browserConnected: false,
  nightlyBriefing: null,
  isBriefingLoading: false,
  isBookmarksLoading: false,
  news: null,
  isNewsRefreshing: false,

  setMode: (mode) => {
    document.body.setAttribute("data-mode", mode);
    set({ mode });
  },

  setOverride: (override) => set({ override }),
  setAudioEnergy: (audioEnergy) => set({ audioEnergy }),
  setCommandPaletteOpen: (isCommandPaletteOpen) => set({ isCommandPaletteOpen }),
  completeBoot: () => set({ isBootComplete: true }),
  setTimelineSegments: (timelineSegments) => set({ timelineSegments }),

  triggerPhaseShift: (newMode) => {
    set({ isPhaseShifting: true });
    document.body.setAttribute("data-mode", newMode);
    setTimeout(() => {
      set({ mode: newMode, isPhaseShifting: false });
    }, 400);
  },

  loadInitialData: async () => {
    try {
      const [briefing, bookmarks, timeline, liveTab, openTabs, memos, nightly, tabHistory] =
        await Promise.allSettled([
          daypilotApi.getMorningBriefing(),
          daypilotApi.getBookmarks(),
          daypilotApi.getTimeline(),
          daypilotApi.getLiveTab(),
          daypilotApi.getOpenTabs(),
          daypilotApi.getMemos(),
          daypilotApi.getNightlyBriefing(),
          daypilotApi.getTabHistory()
        ]);

      set((state) => ({
        briefing: briefing.status === "fulfilled" ? briefing.value : state.briefing,
        bookmarks: bookmarks.status === "fulfilled" ? bookmarks.value : state.bookmarks,
        timelineSegments:
          timeline.status === "fulfilled"
            ? timeline.value
            : state.timelineSegments,
        liveTab: liveTab.status === "fulfilled" ? liveTab.value : state.liveTab,
        openTabs: openTabs.status === "fulfilled" ? openTabs.value.tabs : state.openTabs,
        browserConnected: openTabs.status === "fulfilled" ? openTabs.value.connected : state.browserConnected,
        tabHistory: tabHistory.status === "fulfilled" ? tabHistory.value : state.tabHistory,
        memos: memos.status === "fulfilled" ? memos.value : state.memos,
        nightlyBriefing: nightly.status === "fulfilled" ? nightly.value : state.nightlyBriefing
      }));
    } catch (e) {
      // Backend offline or starting up
    }
  },

  fetchBriefing: async () => {
    set({ isBriefingLoading: true });
    try {
      const briefing = await daypilotApi.getMorningBriefing();
      set({ briefing });
    } catch (e) {
    } finally {
      set({ isBriefingLoading: false });
    }
  },

  fetchBookmarks: async () => {
    set({ isBookmarksLoading: true });
    try {
      const bookmarks = await daypilotApi.getBookmarks();
      set({ bookmarks });
    } catch (e) {
    } finally {
      set({ isBookmarksLoading: false });
    }
  },

  refreshBriefing: async () => {
    try {
      const briefing = await daypilotApi.getMorningBriefing();
      set((state) => {
        if (JSON.stringify(state.briefing) === JSON.stringify(briefing)) return {};
        return { briefing };
      });
    } catch (e) {}
  },

  refreshBookmarks: async () => {
    try {
      const bookmarks = await daypilotApi.getBookmarks();
      set((state) => {
        if (JSON.stringify(state.bookmarks) === JSON.stringify(bookmarks)) return {};
        return { bookmarks };
      });
    } catch (e) {}
  },

  refreshLiveTab: async () => {
    try {
      const [liveTab, open, history] = await Promise.allSettled([
        daypilotApi.getLiveTab(),
        daypilotApi.getOpenTabs(),
        daypilotApi.getTabHistory()
      ]);
      const nextLive = liveTab.status === "fulfilled" ? liveTab.value : null;
      const nextOpen = open.status === "fulfilled" ? open.value.tabs : [];
      const nextConn = open.status === "fulfilled" ? open.value.connected : false;
      const nextHist = history.status === "fulfilled" ? history.value : [];
      set((state) => {
        if (
          JSON.stringify(state.liveTab) === JSON.stringify(nextLive) &&
          JSON.stringify(state.openTabs) === JSON.stringify(nextOpen) &&
          state.browserConnected === nextConn &&
          JSON.stringify(state.tabHistory) === JSON.stringify(nextHist)
        ) {
          return {};
        }
        return {
          liveTab: nextLive,
          openTabs: nextOpen,
          browserConnected: nextConn,
          tabHistory: nextHist
        };
      });
    } catch (e) {}
  },

  refreshTabHistory: async () => {
    try {
      const tabHistory = await daypilotApi.getTabHistory();
      set((state) => {
        if (JSON.stringify(state.tabHistory) === JSON.stringify(tabHistory)) return {};
        return { tabHistory };
      });
    } catch (e) {}
  },

  refreshTimeline: async () => {
    try {
      const timelineSegments = await daypilotApi.getTimeline();
      if (Array.isArray(timelineSegments)) {
        set((state) => {
          if (JSON.stringify(state.timelineSegments) === JSON.stringify(timelineSegments)) return {};
          return { timelineSegments };
        });
      }
    } catch (e) {}
  },

  refreshMemos: async () => {
    try {
      const memos = await daypilotApi.getMemos();
      set((state) => {
        if (JSON.stringify(state.memos) === JSON.stringify(memos)) return {};
        return { memos };
      });
    } catch (e) {}
  },

  refreshNightlyBriefing: async () => {
    try {
      const nightlyBriefing = await daypilotApi.getNightlyBriefing();
      set((state) => {
        if (JSON.stringify(state.nightlyBriefing) === JSON.stringify(nightlyBriefing)) return {};
        return { nightlyBriefing };
      });
    } catch (e) {}
  },

  loadNews: async () => {
    try {
      const news = await daypilotApi.getNews();
      set((state) => {
        if (JSON.stringify(state.news) === JSON.stringify(news)) return {};
        return { news };
      });
    } catch (e) {}
  },

  refreshNews: async () => {
    set({ isNewsRefreshing: true });
    try {
      set({ news: await daypilotApi.refreshNews() });
    } catch (e) {
    } finally {
      set({ isNewsRefreshing: false });
    }
  },

  handleWebSocketMessage: (payload: any, maybeData?: any) => {
    const type = typeof payload === "string" ? payload : payload?.type;
    const data = typeof payload === "string" ? maybeData : payload?.data;

    if (!type) return;

    if (type === "NEWS_UPDATED") {
      get().loadNews();
      return;
    }

    if (type === "MODE_CHANGE" || type === "INITIAL_STATE") {
      if (data) {
        if (data.mode) get().setMode(data.mode as FlightMode);
        if (data.override) get().setOverride(data.override as OverrideMode);
      }
    } else if (type === "TELEMETRY_SYNCED") {
      get().refreshBriefing();
      get().refreshBookmarks();
      get().refreshTimeline();
      get().refreshLiveTab();
      get().refreshNightlyBriefing();
    } else if (type === "LIVE_TAB_UPDATED" || type === "HEARTBEAT_UPDATED") {
      if (data) {
        set({ liveTab: data });
      } else {
        get().refreshLiveTab();
      }
    } else if (
      type === "GITHUB_UPDATED" ||
      type === "BOSSCODER_UPDATED" ||
      type === "EMAILS_UPDATED"
    ) {
      get().refreshBriefing();
    } else if (type === "TABS_UPDATED") {
      set({ openTabs: data?.tabs ?? [], browserConnected: Boolean(data?.connected) });
    } else if (type === "BOOKMARKS_UPDATED") {
      get().refreshBookmarks();
    }
  }
}));
