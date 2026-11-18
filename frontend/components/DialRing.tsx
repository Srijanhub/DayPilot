"use client";

import React, { useState, useEffect } from "react";

export interface TimelineSegment {
  startHour: number; // 0 to 24 (e.g. 9.5 is 9:30 AM)
  endHour: number;
  category: "WORK" | "STUDY" | "MANHWA" | "SHOWS" | "LEISURE";
  label: string;
  duration: string;
}

interface DialRingProps {
  segments?: TimelineSegment[];
}

const CATEGORY_COLORS = {
  WORK: "oklch(0.85 0.18 200)",    // Cyan
  STUDY: "oklch(0.74 0.18 155)",   // Emerald
  MANHWA: "oklch(0.68 0.21 15)",   // Sunset Rose
  SHOWS: "oklch(0.78 0.16 65)",    // Amber
  LEISURE: "oklch(0.60 0.05 250)"  // Slate
};

export default function DialRing({ segments = [] }: DialRingProps) {
  const [currentTimeHour, setCurrentTimeHour] = useState<number>(9);
  const [hoveredSegment, setHoveredSegment] = useState<TimelineSegment | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeHour(now.getHours() + now.getMinutes() / 60);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  const size = 520;
  const center = size / 2;
  const radius = 230;
  const strokeWidth = 8;

  // Converts decimal hour (0-24) to angle in degrees (-90deg is 12 o'clock / 00:00)
  const hourToAngle = (h: number) => (h / 24) * 360 - 90;

  // Polar to Cartesian
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  };

  // SVG arc path builder
  const describeArc = (startH: number, endH: number, r: number) => {
    const startAngle = hourToAngle(startH);
    const endAngle = hourToAngle(endH);
    const start = polarToCartesian(center, center, r, startAngle);
    const end = polarToCartesian(center, center, r, endAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M", start.x, start.y,
      "A", r, r, 0, largeArcFlag, 1, end.x, end.y
    ].join(" ");
  };

  // Current time pointer position
  const currentAngle = hourToAngle(currentTimeHour);
  const pointerPos = polarToCartesian(center, center, radius, currentAngle);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
      >
        <defs>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Background Track Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="oklch(1 0 0 / 0.08)"
          strokeWidth={strokeWidth}
          strokeDasharray="2 4"
        />

        {/* Inner Subtle Calibration Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius - 14}
          fill="none"
          stroke="oklch(1 0 0 / 0.05)"
          strokeWidth="1"
        />

        {/* 24-Hour Markers */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = hourToAngle(i);
          const isMajor = i % 3 === 0;
          const tickStart = polarToCartesian(center, center, radius + (isMajor ? 10 : 6), angle);
          const tickEnd = polarToCartesian(center, center, radius + 2, angle);
          const labelPos = polarToCartesian(center, center, radius + 22, angle);

          return (
            <g key={i}>
              <line
                x1={tickStart.x}
                y1={tickStart.y}
                x2={tickEnd.x}
                y2={tickEnd.y}
                stroke={isMajor ? "oklch(1 0 0 / 0.35)" : "oklch(1 0 0 / 0.12)"}
                strokeWidth={isMajor ? 1.5 : 1}
              />
              {isMajor && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="oklch(1 0 0 / 0.45)"
                  className="font-mono text-[9px] select-none"
                >
                  {i < 10 ? `0${i}` : `${i}`}:00
                </text>
              )}
            </g>
          );
        })}

        {/* Activity Arc Segments */}
        {segments.map((seg, idx) => {
          const pathD = describeArc(seg.startHour, seg.endHour, radius);
          const color = CATEGORY_COLORS[seg.category] || CATEGORY_COLORS.WORK;

          return (
            <path
              key={idx}
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth + 2}
              strokeLinecap="round"
              className="pointer-events-auto cursor-pointer transition-all duration-200 hover:opacity-100 opacity-80"
              filter="url(#ringGlow)"
              onMouseEnter={() => setHoveredSegment(seg)}
              onMouseLeave={() => setHoveredSegment(null)}
            />
          );
        })}

        {/* Current Time Sweeping Cursor */}
        <g className="transition-transform duration-500">
          <circle
            cx={pointerPos.x}
            cy={pointerPos.y}
            r="5"
            fill="var(--accent-primary)"
            filter="url(#ringGlow)"
          />
          <circle
            cx={pointerPos.x}
            cy={pointerPos.y}
            r="8"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="1.5"
            opacity="0.75"
          />
        </g>
      </svg>

      {/* Floating Hover Telemetry Tooltip */}
      {hoveredSegment && (
        <div
          className="absolute pointer-events-none z-30 px-3 py-1.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-hairline)] backdrop-blur-md shadow-xl text-center"
          style={{ transform: "translateY(180px)" }}
        >
          <div className="instrument-label text-[9px] text-[var(--accent-primary)] font-bold">
            {hoveredSegment.category} • {hoveredSegment.duration}
          </div>
          <div className="text-[12px] text-white font-medium">
            {hoveredSegment.label}
          </div>
        </div>
      )}
    </div>
  );
}
