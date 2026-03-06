import { useMemo } from "react";
import type { ConflictEvent } from "../types/event";

const WINDOW = 20;

function lerp(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bl})`;
}

function gaugeColor(level: number): string {
  if (level <= 3) return lerp("#3fb950", "#d29922", level / 3);
  if (level <= 6) return lerp("#d29922", "#f85149", (level - 3) / 3);
  return lerp("#f85149", "#da3633", (level - 6) / 4);
}

function statusLabel(level: number): { text: string; color: string } {
  if (level <= 3) return { text: "LOW ACTIVITY", color: "var(--severity-low)" };
  if (level <= 6) return { text: "ELEVATED", color: "var(--severity-mid)" };
  if (level <= 8) return { text: "HIGH ALERT", color: "var(--severity-high)" };
  return { text: "CRITICAL", color: "#ff2020" };
}

interface EscalationGaugeProps {
  events: ConflictEvent[];
}

export function EscalationGauge({ events }: EscalationGaugeProps) {
  const level = useMemo(() => {
    const recent = events.slice(0, WINDOW);
    if (recent.length === 0) return 0;
    const avg = recent.reduce((sum, e) => sum + e.severity, 0) / recent.length;
    return Math.round(avg * 10) / 10;
  }, [events]);

  const pct = Math.min(level / 10, 1);
  const color = gaugeColor(level);
  const status = statusLabel(level);

  // Glow intensity scales with level (0 to 1)
  const glowIntensity = Math.min(level / 10, 1);
  const glowAlpha = (0.1 + glowIntensity * 0.4).toFixed(2);
  const glowSpread = Math.round(4 + glowIntensity * 12);

  // Arc gauge using SVG
  const radius = 70;
  const stroke = 12;
  const circumference = Math.PI * radius; // semicircle
  const offset = circumference * (1 - pct);

  return (
    <div
      className="panel"
      style={{
        gridArea: "gauge",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        boxShadow: `0 0 ${glowSpread}px rgba(${level > 6 ? "248,81,73" : level > 3 ? "210,153,34" : "63,185,80"},${glowAlpha}), 0 0 1px var(--border-glow)`,
        transition: "box-shadow 1s ease",
      }}
    >
      <svg width="180" height="100" viewBox="0 0 180 100">
        {/* Background arc */}
        <path
          d="M 10 90 A 70 70 0 0 1 170 90"
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d="M 10 90 A 70 70 0 0 1 170 90"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.8s ease, stroke 0.8s ease",
            filter: `drop-shadow(0 0 ${3 + glowIntensity * 6}px ${color})`,
          }}
        />
        {/* Level number */}
        <text
          x="90"
          y="78"
          textAnchor="middle"
          fill={color}
          fontSize="30"
          fontWeight="700"
          fontFamily="var(--font-mono)"
          style={{ transition: "fill 0.8s ease" }}
        >
          {level.toFixed(1)}
        </text>
      </svg>

      {/* Status text */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 3,
          color: status.color,
          marginTop: 2,
          fontFamily: "var(--font-mono)",
          transition: "color 0.8s ease",
          animation: level >= 7 ? "pulse 2s ease-in-out infinite" : undefined,
        }}
      >
        {status.text}
      </div>

      <div
        style={{
          fontSize: 9,
          letterSpacing: 2,
          color: "var(--text-secondary)",
          marginTop: 6,
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          textTransform: "uppercase",
        }}
      >
        ESCALATION LEVEL
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--text-secondary)",
          marginTop: 2,
          fontFamily: "var(--font-mono)",
          opacity: 0.6,
        }}
      >
        rolling avg / last {WINDOW}
      </div>
    </div>
  );
}
