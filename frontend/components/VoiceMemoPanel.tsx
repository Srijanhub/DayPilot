"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Check, AudioWaveform, Clock, AlertCircle, ShieldAlert, Sparkles } from "lucide-react";
import { daypilotApi } from "@/lib/api";

interface VoiceMemo {
  id?: number;
  time: string;
  text: string;
  action: string;
  duration?: number;
}

export default function VoiceMemoPanel() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>("prompt");
  const [memos, setMemos] = useState<VoiceMemo[]>([
    {
      time: "08:45 AM",
      text: "Review BossCoder Dynamic Programming Lab 4 edge cases and check active GitHub PR comments.",
      action: "Review DP Lab 4 edge cases"
    }
  ]);

  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const latestTranscriptRef = useRef<string>("");

  // Load saved voice memos from local SQLite backend
  const fetchMemos = async () => {
    try {
      const data = await daypilotApi.getMemos();
      if (Array.isArray(data) && data.length > 0) {
        setMemos(data);
      }
    } catch (e) {
      // Backend temporarily offline
    }
  };

  useEffect(() => {
    fetchMemos();
    if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "microphone" as any })
        .then((perm) => {
          setPermissionStatus(perm.state);
          perm.onchange = () => setPermissionStatus(perm.state);
        })
        .catch(() => {});
    }
  }, []);

  const requestMicPermission = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermissionStatus("granted");
      return true;
    } catch (err: any) {
      setPermissionStatus("denied");
      setErrorMessage(
        "Microphone access blocked. Click the lock/settings icon in your browser address bar or open macOS System Settings > Privacy & Security > Microphone to grant permission."
      );
      return false;
    }
  };

  const getBestMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
      "audio/ogg"
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "";
  };

  const startRecording = async () => {
    setErrorMessage(null);
    setLiveTranscript("");
    latestTranscriptRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionStatus("granted");
      const mimeType = getBestMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const recordedType = mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: recordedType });
        const formData = new FormData();
        const ext = recordedType.includes("mp4") ? "m4a" : "webm";
        formData.append("file", audioBlob, `memo.${ext}`);
        formData.append("duration", recordingDuration.toString());
        formData.append("transcript", latestTranscriptRef.current);

        try {
          const data = await daypilotApi.uploadMemo(formData);
          const newMemo: VoiceMemo = {
            time: data.time || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            text: data.transcription || latestTranscriptRef.current || "Audio note recorded.",
            action: data.action_item || "Review audio memo"
          };
          setMemos((prev) => [newMemo, ...prev]);
        } catch (err) {
          // Offline fallback
          const fallbackText = latestTranscriptRef.current || "Voice brain dump recorded.";
          setMemos((prev) => [
            {
              time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
              text: fallbackText,
              action: fallbackText.slice(0, 35)
            },
            ...prev
          ]);
        }
        setLiveTranscript("");
      };

      // Initialize browser SpeechRecognition if available
      const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechClass) {
        try {
          const recognizer = new SpeechClass();
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.lang = "en-US";

          recognizer.onresult = (event: any) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript + " ";
            }
            const clean = fullText.trim();
            setLiveTranscript(clean);
            latestTranscriptRef.current = clean;
          };

          recognizer.onerror = () => {};
          recognizer.start();
          speechRecognitionRef.current = recognizer;
        } catch (e) {}
      }

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setPermissionStatus("denied");
      setErrorMessage("Microphone access was denied. Please click 'ALLOW ACCESS' below to trigger the permission prompt.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
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
        <div className="flex items-center space-x-2">
          {permissionStatus === "granted" ? (
            <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>MIC READY</span>
            </span>
          ) : (
            <button
              onClick={requestMicPermission}
              className="text-xs font-mono text-[var(--accent-primary)] underline hover:text-white"
            >
              GRANT PERMISSION
            </button>
          )}
        </div>
      </div>

      {/* Permission Request Alert Banner */}
      {permissionStatus !== "granted" && (
        <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent-ring)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Microphone Permission Needed</div>
              <div className="text-xs font-mono text-[var(--text-muted)]">
                Allow microphone access to record quick audio thought dumps
              </div>
            </div>
          </div>
          <button
            onClick={requestMicPermission}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-black font-mono text-xs font-bold hover:scale-105 active:scale-95 transition whitespace-nowrap self-start sm:self-auto shadow-md"
          >
            ALLOW MIC ACCESS
          </button>
        </div>
      )}

      {/* Record Controller */}
      <div className="p-3.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-[var(--accent-primary)] text-black hover:scale-105"
              }`}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>
            <div>
              <div className="text-sm font-semibold text-white">
                {isRecording ? "Recording in progress..." : "Quick Audio Thought"}
              </div>
              <div className="text-xs font-mono text-[var(--text-muted)]">
                {isRecording ? `${recordingDuration}s elapsed` : "Saves to ~/daypilot/memos"}
              </div>
            </div>
          </div>

          {isRecording && (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono text-rose-400 font-bold animate-pulse">REC</span>
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            </div>
          )}
        </div>

        {/* Live spoken preview */}
        {isRecording && liveTranscript && (
          <div className="p-2.5 rounded bg-black/50 border border-[var(--accent-ring)] text-xs text-[var(--accent-primary)] font-mono animate-fadeIn">
            <span className="text-[var(--text-muted)] mr-1.5">[LIVE SPEECH]:</span>
            "{liveTranscript}"
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800/40 text-xs text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div>{errorMessage}</div>
              <button
                onClick={requestMicPermission}
                className="underline font-bold text-white hover:text-[var(--accent-primary)]"
              >
                Click here to prompt again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Memos */}
      <div className="space-y-2">
        <div className="instrument-label text-xs text-[var(--text-muted)]">
          RECENT AUDIO THOUGHTS & EXTRACTED ACTIONS ({memos.length})
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {memos.map((m, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs space-y-1 hover:border-[var(--border-active)] transition">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--accent-primary)] font-semibold">
                <span>ACTION: {m.action}</span>
                <span className="text-[var(--text-muted)] font-normal">{m.time}</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                "{m.text}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
