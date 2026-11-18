"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  ExternalLink,
  GraduationCap,
  GitPullRequest,
  BookOpen,
  Zap,
  Target,
  AlertTriangle,
  Volume2,
  VolumeX,
  Sparkles
} from "lucide-react";
import { useFlightDeckStore, FlightMode } from "@/store/useFlightDeckStore";

interface OrbTacticalHubProps {
  onBreathingChange?: (isBreathing: boolean) => void;
}

export default function OrbTacticalHub({ onBreathingChange }: OrbTacticalHubProps) {
  const { mode } = useFlightDeckStore();

  // Pomodoro Focus Sprint State
  const [sprintDuration, setSprintDuration] = useState<number>(25 * 60); // 25 mins default
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [breathPhase, setBreathPhase] = useState<"INHALE" | "HOLD_IN" | "EXHALE" | "HOLD_OUT">("INHALE");
  const [breathCounter, setBreathCounter] = useState<number>(4);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [showCenterTimer, setShowCenterTimer] = useState<boolean>(false);

  // Live satellite data from backend
  const [bosscoderItem, setBosscoderItem] = useState<{ title: string; subtitle: string; url: string }>({
    title: "DSA // QUICK SORT",
    subtitle: "Tutorial 11 with Ankur Raj",
    url: "https://school.bosscoderacademy.com/home"
  });

  const [githubItem, setGithubItem] = useState<{ title: string; subtitle: string; url: string }>({
    title: "PR REVIEW // SHARDING",
    subtitle: "apache/shardingsphere #40449",
    url: "https://github.com/apache/shardingsphere/pull/40449"
  });

  const [mediaItem, setMediaItem] = useState<{ title: string; subtitle: string; url: string }>({
    title: "MANHWA // GENIUS SWORDSMAN",
    subtitle: "Chapter 76 on ToonGod",
    url: "https://www.toongod.org/webtoon/academys-genius-swordsman/chapter-76/"
  });

  // Fetch live satellite targets from backend
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const [briefingRes, bookmarksRes] = await Promise.all([
          fetch("http://127.0.0.1:4000/api/briefing/morning").catch(() => null),
          fetch("http://127.0.0.1:4000/api/bookmarks").catch(() => null)
        ]);

        if (briefingRes && briefingRes.ok) {
          const briefing = await briefingRes.json();
          if (briefing.bosscoder_alerts && briefing.bosscoder_alerts.length > 0) {
            const b = briefing.bosscoder_alerts[0];
            setBosscoderItem({
              title: "DSA // BOSSCODER",
              subtitle: b.title || "DSA Tutorial 11",
              url: b.url || "https://school.bosscoderacademy.com/home"
            });
          }
          if (briefing.github_prs && briefing.github_prs.length > 0) {
            const g = briefing.github_prs[0];
            setGithubItem({
              title: "GITHUB // PR REVIEW",
              subtitle: `${g.repo} ${g.pr}`,
              url: g.url || "https://github.com/Srijanhub/DayPilot"
            });
          }
        }

        if (bookmarksRes && bookmarksRes.ok) {
          const bookmarks = await bookmarksRes.json();
          if (Array.isArray(bookmarks) && bookmarks.length > 0) {
            const m = bookmarks[0];
            setMediaItem({
              title: `RESUME // ${m.media_type}`,
              subtitle: `${m.title} (${m.current_unit})`,
              url: m.resume_url || ""
            });
          }
        }
      } catch (e) {}
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio chime generator
  const playChime = (freq = 440, type: OscillatorType = "sine") => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {}
  };

  // Timer countdown loop
  useEffect(() => {
    let timer: any = null;
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      playChime(880, "triangle");
      if (onBreathingChange) onBreathingChange(false);
    }
    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  // Box-Breathing pacer loop (4s Inhale, 4s Hold, 4s Exhale, 4s Hold)
  useEffect(() => {
    let breathTimer: any = null;
    if (isActive) {
      if (onBreathingChange) onBreathingChange(true);
      breathTimer = setInterval(() => {
        setBreathCounter((prev) => {
          if (prev <= 1) {
            setBreathPhase((current) => {
              if (current === "INHALE") return "HOLD_IN";
              if (current === "HOLD_IN") return "EXHALE";
              if (current === "EXHALE") return "HOLD_OUT";
              return "INHALE";
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (onBreathingChange) onBreathingChange(false);
      setBreathCounter(4);
      setBreathPhase("INHALE");
    }
    return () => clearInterval(breathTimer);
  }, [isActive]);

  const toggleSprint = () => {
    const nextState = !isActive;
    setIsActive(nextState);
    setShowCenterTimer(true);
    playChime(nextState ? 587.33 : 329.63, "sine");
  };

  const resetSprint = () => {
    setIsActive(false);
    setTimeLeft(sprintDuration);
    playChime(392.0, "sine");
  };

  const addTime = (minutes: number) => {
    setTimeLeft((prev) => prev + minutes * 60);
    playChime(659.25, "sine");
  };

  const openUrl = (url: string) => {
    if (!url) return;
    try {
      window.open(url, "_blank");
    } catch (e) {}
    fetch("http://127.0.0.1:4000/api/open-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }).catch(() => {});
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPercent = ((sprintDuration - timeLeft) / sprintDuration) * 100;

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-center justify-center select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. CENTER FOCUS CORE HUD OVERLAY */}
      <div
        className={`pointer-events-auto transition-all duration-500 flex flex-col items-center justify-center z-30 cursor-pointer ${
          isActive || showCenterTimer || isHovered ? "opacity-100 scale-100" : "opacity-90 scale-95"
        }`}
        onClick={() => {
          if (!isActive && !showCenterTimer) {
            setShowCenterTimer(true);
          }
        }}
      >
        {/* Glowing Center Ring and Monospace Timer */}
        <div className="relative flex flex-col items-center justify-center p-6 rounded-full bg-black/40 backdrop-blur-md border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] shadow-2xl transition-all duration-300">
          
          {/* Circular SVG Progress Meter */}
          {isActive && (
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                cx="50%"
                cy="50%"
                r="46%"
                fill="none"
                stroke="oklch(1 0 0 / 0.1)"
                strokeWidth="2.5"
              />
              <circle
                cx="50%"
                cy="50%"
                r="46%"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2.5"
                strokeDasharray="290"
                strokeDashoffset={290 - (290 * progressPercent) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
          )}

          {/* Time Display */}
          <div className="flex items-center space-x-1 font-mono text-2xl font-bold tracking-tight text-white drop-shadow-[0_0_12px_var(--accent-glow)]">
            <Target className={`w-5 h-5 ${isActive ? "text-[var(--accent-primary)] animate-pulse" : "text-slate-400"}`} />
            <span>{formatTime(timeLeft)}</span>
          </div>

          {/* Status / Subtitle */}
          <div className="text-[10px] font-mono tracking-widest text-[var(--accent-primary)] uppercase mt-0.5">
            {isActive ? "FLOW SPRINT ACTIVE" : "POMODORO READY"}
          </div>

          {/* Breathing Pacer Bar during Active Sprint */}
          {isActive && (
            <div className="mt-2 text-[10px] font-mono text-slate-300 flex items-center space-x-1.5 animate-fadeIn">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>
                {breathPhase === "INHALE" && "INHALE (BREATHE IN)"}
                {breathPhase === "HOLD_IN" && "HOLD LUNGS EXPANDED"}
                {breathPhase === "EXHALE" && "EXHALE (RELEASE)"}
                {breathPhase === "HOLD_OUT" && "HOLD EMPTY & STILL"}
              </span>
              <span className="font-bold text-[var(--accent-primary)]">[{breathCounter}s]</span>
            </div>
          )}

          {/* Interactive Controls Overlay */}
          <div className="flex items-center space-x-2 mt-2 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSprint();
              }}
              className={`p-1.5 rounded-full transition-all ${
                isActive
                  ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  : "bg-[var(--accent-primary)] text-black hover:scale-105"
              }`}
              title={isActive ? "Pause Sprint" : "Ignite Sprint"}
            >
              {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                resetSprint();
              }}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                addTime(5);
              }}
              className="px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-mono text-slate-300 hover:text-white transition flex items-center space-x-0.5"
              title="Add 5 Minutes"
            >
              <Plus className="w-2.5 h-2.5" />
              <span>5M</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setSoundEnabled(!soundEnabled);
              }}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition"
              title={soundEnabled ? "Mute Chimes" : "Enable Chimes"}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Distraction warning banner if mode shifts to RELAX during sprint */}
        {isActive && mode === "RELAX" && (
          <div className="mt-2 px-3 py-1 rounded bg-rose-950/80 border border-rose-700/60 text-rose-300 text-[10px] font-mono flex items-center space-x-1.5 animate-bounce shadow-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>DISTRACTION DETECTED: RETURN TO FLOW</span>
          </div>
        )}
      </div>

      {/* 2. HOLOGRAPHIC SATELLITE NODES ORBITING THE SPHERE */}

      {/* Satellite 1: TOP (12 o'clock) -> Focus Mode Quick Shift */}
      <div
        onClick={toggleSprint}
        className="pointer-events-auto absolute top-10 sm:top-12 flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-105 z-20"
      >
        <div className="px-3.5 py-1.5 rounded-full bg-[var(--bg-elevated)]/90 backdrop-blur-md border border-[var(--border-hairline)] group-hover:border-[var(--accent-primary)] flex items-center space-x-2 shadow-lg">
          <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-pulse" />
          <span className="text-xs font-mono font-bold text-white group-hover:text-[var(--accent-primary)] transition">
            {isActive ? `SPRINT: ${formatTime(timeLeft)}` : "IGNITE FOCUS [25M]"}
          </span>
        </div>
        {/* Laser Connector Line pointing down */}
        <div className="w-[1px] h-5 bg-gradient-to-b from-[var(--accent-primary)] to-transparent opacity-40 group-hover:opacity-100 transition" />
      </div>

      {/* Satellite 2: RIGHT (3 o'clock) -> BossCoder Next Class */}
      <div
        onClick={() => openUrl(bosscoderItem.url)}
        className="pointer-events-auto absolute right-6 sm:right-12 md:right-20 flex items-center group cursor-pointer transition-all duration-300 hover:scale-105 z-20"
      >
        {/* Laser Connector Line pointing left */}
        <div className="w-5 h-[1px] bg-gradient-to-r from-transparent to-[#10b981] opacity-40 group-hover:opacity-100 transition" />
        <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)]/90 backdrop-blur-md border border-[var(--border-hairline)] group-hover:border-[#10b981] flex items-center space-x-2.5 shadow-lg">
          <div className="w-6 h-6 rounded-lg bg-[#10b981]/15 flex items-center justify-center shrink-0">
            <GraduationCap className="w-3.5 h-3.5 text-[#10b981]" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-[#10b981] uppercase font-bold flex items-center space-x-1">
              <span>{bosscoderItem.title}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="text-xs font-semibold text-white truncate max-w-[150px]">
              {bosscoderItem.subtitle}
            </div>
          </div>
        </div>
      </div>

      {/* Satellite 3: BOTTOM (6 o'clock) -> Media Radar (Manhwa / Show) */}
      <div
        onClick={() => openUrl(mediaItem.url)}
        className="pointer-events-auto absolute bottom-8 sm:bottom-10 flex flex-col items-center group cursor-pointer transition-all duration-300 hover:scale-105 z-20"
      >
        {/* Laser Connector Line pointing up */}
        <div className="w-[1px] h-5 bg-gradient-to-t from-[#f59e0b] to-transparent opacity-40 group-hover:opacity-100 transition" />
        <div className="px-3.5 py-1.5 rounded-full bg-[var(--bg-elevated)]/90 backdrop-blur-md border border-[var(--border-hairline)] group-hover:border-[#f59e0b] flex items-center space-x-2 shadow-lg">
          <BookOpen className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span className="text-xs font-mono font-semibold text-white group-hover:text-[#f59e0b] transition">
            {mediaItem.subtitle}
          </span>
          <ExternalLink className="w-3 h-3 text-[#f59e0b] opacity-0 group-hover:opacity-100 transition" />
        </div>
      </div>

      {/* Satellite 4: LEFT (9 o'clock) -> GitHub Open PR Review */}
      <div
        onClick={() => openUrl(githubItem.url)}
        className="pointer-events-auto absolute left-6 sm:left-12 md:left-20 flex items-center group cursor-pointer transition-all duration-300 hover:scale-105 z-20"
      >
        <div className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)]/90 backdrop-blur-md border border-[var(--border-hairline)] group-hover:border-[var(--accent-primary)] flex items-center space-x-2.5 shadow-lg">
          <div className="w-6 h-6 rounded-lg bg-[var(--accent-primary)]/15 flex items-center justify-center shrink-0">
            <GitPullRequest className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-[var(--accent-primary)] uppercase font-bold flex items-center space-x-1">
              <span>{githubItem.title}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition" />
            </div>
            <div className="text-xs font-semibold text-white truncate max-w-[150px]">
              {githubItem.subtitle}
            </div>
          </div>
        </div>
        {/* Laser Connector Line pointing right */}
        <div className="w-5 h-[1px] bg-gradient-to-l from-transparent to-[var(--accent-primary)] opacity-40 group-hover:opacity-100 transition" />
      </div>
    </div>
  );
}
