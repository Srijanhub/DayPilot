"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";
import { Play, Pause, SkipForward, Volume2, Music, Radio, Disc3 } from "lucide-react";

export default function MusicPlayerPanel() {
  const { mode, setAudioEnergy } = useFlightDeckStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>(() => Array(24).fill(10));

  const playlistClusters = {
    WORK: {
      cluster: "Deep Focus Flow",
      reason: "84% correlation with your coding focus sessions",
      tracks: [
        { title: "Resonance", artist: "HOME", genre: "Synthwave", duration: "3:32" },
        { title: "Cyberpunk 2077 Focus Mix", artist: "Marconi Union", genre: "Dark Ambient", duration: "4:15" },
        { title: "Ghost in the Shell OST", artist: "Kenji Kawai", genre: "Instrumental", duration: "5:02" }
      ]
    },
    STUDY: {
      cluster: "Study & Problem Solving",
      reason: "High memory retention during algorithmic problem solving",
      tracks: [
        { title: "Lofi Rain Beats", artist: "ChilledCow", genre: "Lo-Fi", duration: "2:45" },
        { title: "Gymnopédie No. 1", artist: "Erik Satie", genre: "Classical Piano", duration: "3:10" },
        { title: "Zelda & Chill", artist: "Mikel", genre: "Video Game OST", duration: "3:40" }
      ]
    },
    RELAX: {
      cluster: "Late Night Chill",
      reason: "Optimal decompression while reading manhwa",
      tracks: [
        { title: "Weightless", artist: "Marconi Union", genre: "Ambient Soundscape", duration: "8:05" },
        { title: "Coffee & Raindrops", artist: "Kudasaibeats", genre: "Downtempo", duration: "2:20" },
        { title: "Suzume Theme (Acoustic)", artist: "Radwimps", genre: "Anime Chill", duration: "4:10" }
      ]
    }
  };

  const currentCluster = playlistClusters[mode] || playlistClusters.WORK;
  const currentTrack = currentCluster.tracks[currentTrackIdx] || currentCluster.tracks[0];

  // Simulated visualizer feeding the 3D Orb shader
  useEffect(() => {
    let animId: number;
    let intervalId: NodeJS.Timeout;
    let t = 0;
    if (isPlaying) {
      const loop = () => {
        t += 0.08;
        // Periodic energetic pulse simulating bass & mids
        const energy = Math.abs(Math.sin(t)) * 0.4 + Math.abs(Math.cos(t * 1.5)) * 0.3;
        setAudioEnergy(energy);
        animId = requestAnimationFrame(loop);
      };
      loop();

      intervalId = setInterval(() => {
        setBarHeights(
          Array.from({ length: 24 }).map((_, i) => {
            const val = Math.abs(Math.sin(t * 2 + i * 0.5)) * 75 + Math.random() * 25;
            return Math.max(15, Math.min(100, Math.round(val)));
          })
        );
      }, 100);
    } else {
      setAudioEnergy(0.0);
      setBarHeights(Array(24).fill(10));
    }
    return () => {
      cancelAnimationFrame(animId);
      clearInterval(intervalId);
    };
  }, [isPlaying, setAudioEnergy]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const nextTrack = () => setCurrentTrackIdx((prev) => (prev + 1) % currentCluster.tracks.length);

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Disc3 className={`w-4 h-4 text-[var(--accent-primary)] ${isPlaying ? "animate-spin" : ""}`} />
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            AD-FREE MUSIC ENGINE // YT STREAM
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
          ZERO ADS
        </span>
      </div>

      {/* Cluster & Intelligence explanation */}
      <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)]">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-mono text-[var(--accent-primary)] font-bold uppercase">
            {currentCluster.cluster}
          </span>
          <span className="text-[9px] font-mono text-slate-400">AI CURATED</span>
        </div>
        <p className="text-[11px] text-slate-400 italic">
          "{currentCluster.reason}"
        </p>
      </div>

      {/* Now Playing Bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
        <div className="truncate mr-3">
          <div className="text-xs font-semibold text-white truncate">{currentTrack.title}</div>
          <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
            {currentTrack.artist} • {currentTrack.genre}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-[var(--accent-primary)] text-black flex items-center justify-center hover:scale-105 transition shadow-lg"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
          </button>
          <button
            onClick={nextTrack}
            className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] hover:border-[var(--border-active)] flex items-center justify-center text-white transition"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Audio Visualizer Bars */}
      <div className="flex items-end space-x-1 h-5 pt-1 px-1">
        {barHeights.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-100"
            style={{
              height: `${height}%`,
              backgroundColor: "var(--accent-primary)",
              opacity: isPlaying ? 0.8 : 0.2
            }}
          />
        ))}
      </div>
    </div>
  );
}
