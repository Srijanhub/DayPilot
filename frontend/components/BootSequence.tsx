"use client";

import React, { useState, useEffect } from "react";
import { useFlightDeckStore } from "@/store/useFlightDeckStore";

export default function BootSequence() {
  const { isBootComplete, completeBoot } = useFlightDeckStore();
  const [step, setStep] = useState(0);

  const modules = [
    { name: "GOOGLE CALENDAR", status: "SYNCED" },
    { name: "GMAIL PRIORITY DIGEST", status: "VERIFIED" },
    { name: "BOSSCODER ACADEMY", status: "ONLINE" },
    { name: "GITHUB NOTIFICATIONS", status: "RESOLVED" },
    { name: "MORNING NEWSPAPER FEED", status: "INDEXED" },
  ];

  useEffect(() => {
    if (isBootComplete) return;

    // Check if already booted today
    const lastBoot = localStorage.getItem("daypilot_last_boot");
    const today = new Date().toISOString().split("T")[0];
    if (lastBoot === today) {
      completeBoot();
      return;
    }

    const interval = setInterval(() => {
      setStep((prev) => {
        if (prev >= modules.length) {
          clearInterval(interval);
          setTimeout(() => {
            localStorage.setItem("daypilot_last_boot", today);
            completeBoot();
          }, 600);
          return prev;
        }
        return prev + 1;
      });
    }, 450);

    const handleSkip = () => {
      localStorage.setItem("daypilot_last_boot", today);
      completeBoot();
    };
    window.addEventListener("keydown", handleSkip);
    window.addEventListener("click", handleSkip);

    return () => {
      clearInterval(interval);
      window.removeEventListener("keydown", handleSkip);
      window.removeEventListener("click", handleSkip);
    };
  }, [isBootComplete, completeBoot]);

  if (isBootComplete) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090d16] text-[#e2e8f0] font-mono select-none">
      <div className="w-full max-w-md p-8 border border-[var(--border-hairline)] bg-[var(--bg-elevated)] rounded-xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3 mb-6">
          <span className="text-xs font-bold text-[var(--accent-primary)] tracking-widest">
            DAYPILOT // COCKPIT BOOT SEQUENCE
          </span>
          <span className="text-[10px] text-[var(--text-muted)] animate-pulse">
            INITIATING...
          </span>
        </div>

        <div className="space-y-3 mb-8">
          {modules.map((mod, idx) => {
            const isLoaded = idx < step;
            const isCurrent = idx === step;

            return (
              <div key={mod.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      isLoaded
                        ? "bg-[#10b981] shadow-[0_0_8px_#10b981]"
                        : isCurrent
                        ? "bg-[var(--accent-primary)] animate-ping"
                        : "bg-slate-700"
                    }`}
                  />
                  <span className={isLoaded ? "text-white font-medium" : "text-slate-500"}>
                    {mod.name}
                  </span>
                </div>
                <span className={`text-[10px] ${isLoaded ? "text-[#10b981]" : "text-slate-600"}`}>
                  {isLoaded ? `[ ${mod.status} ]` : "[ LOCKING... ]"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] border-t border-[var(--border-hairline)] pt-4">
          <span>ALL TELEMETRY PASSIVE & LOCAL</span>
          <span className="underline cursor-pointer">Press any key to skip</span>
        </div>
      </div>
    </div>
  );
}
