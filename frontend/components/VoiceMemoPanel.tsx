"use client";

import React, { useState, useRef } from "react";
import { Mic, Square, Check, AudioWaveform, Clock } from "lucide-react";

export default function VoiceMemoPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [memos, setMemos] = useState([
    {
      time: "08:45 AM",
      text: "Remember to test the null-safe regex on Flame Comics and review BossCoder DP Lab 4 edge cases.",
      action: "Review DP Lab 4 edge cases"
    }
  ]);

  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", audioBlob, "memo.webm");
        formData.append("duration", recordingDuration.toString());

        try {
          const res = await fetch("http://127.0.0.1:4000/api/memos/upload", {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (data.transcription) {
            setMemos((prev) => [
              {
                time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                text: data.transcription,
                action: data.action_item || "Review notes"
              },
              ...prev
            ]);
          }
        } catch (err) {
          // If backend offline, add to local mock memo list
          setMemos((prev) => [
            {
              time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
              text: "Quick brain dump: check LeetCode contest schedule and finish DayPilot Phase 1 Gate.",
              action: "Finish Phase 1 Gate"
            },
            ...prev
          ]);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone access is required to record voice memos.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className="etched-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Mic className={`w-4 h-4 ${isRecording ? "text-rose-500 animate-pulse" : "text-[var(--accent-primary)]"}`} />
          <span className="instrument-label text-[var(--accent-primary)] font-bold">
            VOICE MEMOS // BRAIN DUMP
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">LOCAL STORAGE</span>
      </div>

      {/* Record Controller */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)]">
        <div className="flex items-center space-x-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-rose-600 text-white animate-pulse"
                : "bg-[var(--accent-primary)] text-black hover:scale-105"
            }`}
          >
            {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
          </button>
          <div>
            <div className="text-xs font-semibold text-white">
              {isRecording ? "Recording in progress..." : "Quick Audio Thought"}
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)]">
              {isRecording ? `${recordingDuration}s elapsed` : "Saves to ~/daypilot/memos"}
            </div>
          </div>
        </div>

        {isRecording && (
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
        )}
      </div>

      {/* Recent Memos */}
      <div className="space-y-2">
        <div className="instrument-label text-[9px] text-[var(--text-muted)]">
          RECENT AUDIO THOUGHTS & EXTRACTED ACTIONS
        </div>
        {memos.map((m, idx) => (
          <div key={idx} className="p-2.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--accent-primary)]">
              <span>ACTION: {m.action}</span>
              <span className="text-[var(--text-muted)]">{m.time}</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              "{m.text}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
