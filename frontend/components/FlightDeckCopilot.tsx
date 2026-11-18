"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Sparkles, Terminal, ChevronUp, Bot, ExternalLink, RefreshCw } from "lucide-react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  source?: string;
  timestamp: string;
}

export default function FlightDeckCopilot() {
  const { mode } = useFlightDeckStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Flight Deck Copilot initialized. I have full live telemetry of your active tabs, BossCoder courses, GitHub PRs, and executive email summaries. How can I assist you right now?",
      source: "SYSTEM",
      timestamp: "12:00"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Cmd + J to toggle copilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch("http://127.0.0.1:4000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          history: historyPayload
        })
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          role: "assistant",
          content: data.reply,
          source: data.source,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error("Failed to send message");
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Telemetry connection error. Ensure the FastAPI backend is running on 127.0.0.1:4000.",
          source: "ERROR",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "What are my GitHub open PRs?",
    "Check my BossCoder DSA progress",
    "Summarize my latest emails",
    "What is my current active tab & dwell time?"
  ];

  return (
    <>
      {/* Floating Tactical Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border-hairline)] hover:border-[var(--accent-primary)] shadow-2xl flex items-center space-x-2.5 transition group cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-ping" />
          <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
          <span className="text-xs font-mono font-bold text-white group-hover:text-[var(--accent-primary)] transition">
            COPILOT ONLINE
          </span>
          <kbd className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-base)] text-[var(--text-muted)] border border-[var(--border-hairline)]">
            ⌘J
          </kbd>
        </button>
      )}

      {/* Expanded Flight Deck Copilot Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-lg h-[620px] rounded-2xl bg-[var(--bg-base)] border border-[var(--border-hairline)] shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Cockpit Top Bar */}
          <div className="px-4 py-3 border-b border-[var(--border-hairline)] bg-[var(--bg-elevated)] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
              <Terminal className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="instrument-label text-[10px] text-[var(--accent-primary)] font-bold">
                FLIGHT DECK COPILOT // LIVE CONTEXT
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[var(--bg-base)] text-slate-300 border border-[var(--border-hairline)]">
                MODE: [{mode}]
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1`}
                >
                  <div className="flex items-center space-x-1.5 text-[9px] text-[var(--text-muted)]">
                    <span>{isUser ? "YOU" : "COPILOT"}</span>
                    <span>•</span>
                    <span>{m.timestamp}</span>
                    {m.source && (
                      <>
                        <span>•</span>
                        <span className="text-[var(--accent-primary)]">[{m.source}]</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? "bg-[var(--accent-primary)] text-black font-semibold rounded-tr-none shadow-md"
                        : "bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-slate-100 rounded-tl-none font-sans"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center space-x-2 text-xs text-[var(--text-muted)] p-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-spin" />
                <span className="font-mono text-[10px]">Copilot synthesizing with telemetry context...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Context Prompt Chips */}
          <div className="px-3 py-2 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(p)}
                className="shrink-0 text-[10px] font-mono px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-black border border-[var(--border-hairline)] text-slate-300 transition cursor-pointer"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-[var(--border-hairline)] bg-[var(--bg-elevated)] flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Copilot anything about your code, tasks, or courses... (Enter to send)"
              className="flex-1 bg-[var(--bg-base)] border border-[var(--border-hairline)] focus:border-[var(--accent-primary)] rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none transition"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="p-2 rounded-lg bg-[var(--accent-primary)] text-black disabled:opacity-40 hover:opacity-90 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
