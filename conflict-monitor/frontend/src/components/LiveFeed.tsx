import { useCallback, useEffect, useRef, useState } from "react";
import type { ConflictEvent } from "../types/event";

const TYPE_COLORS: Record<string, string> = {
  military: "#f85149",
  diplomatic: "#58a6ff",
  economic: "#d29922",
  cyber: "#bc8cff",
};

function severityColor(s: number): string {
  if (s <= 3) return "var(--severity-low)";
  if (s <= 6) return "var(--severity-mid)";
  return "var(--severity-high)";
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tiny blip sound via Web Audio API
function playBlip() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    setTimeout(() => ctx.close(), 200);
  } catch {
    // Audio not available
  }
}

interface LiveFeedProps {
  events: ConflictEvent[];
}

export function LiveFeed({ events }: LiveFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const prevCountRef = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Track newly arrived events for the "NEW" flash
  useEffect(() => {
    if (events.length > prevCountRef.current && prevCountRef.current > 0) {
      const incoming = new Set(
        events.slice(0, events.length - prevCountRef.current).map((e) => e.id),
      );
      setNewIds(incoming);
      if (soundEnabled) playBlip();
      const timer = setTimeout(() => setNewIds(new Set()), 3000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = events.length;
  }, [events, soundEnabled]);

  useEffect(() => {
    prevCountRef.current = events.length;
  }, [events.length]);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    setAutoScroll(containerRef.current.scrollTop < 10);
  }, []);

  const lastUpdated =
    events.length > 0
      ? `Last: ${timeAgo(events[0].timestamp)}`
      : "";

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        height: "100%",
      }}
    >
      {/* Scan-line overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "60px",
            background:
              "linear-gradient(180deg, transparent 0%, rgba(88,166,255,0.03) 50%, transparent 100%)",
            animation: "scanLine 8s linear infinite",
          }}
        />
      </div>

      {/* Header bar */}
      <div
        style={{
          padding: "10px 16px",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 2,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-sans)",
        }}
      >
        <span>LIVE FEED</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => setSoundEnabled((p) => !p)}
            title={soundEnabled ? "Mute alerts" : "Enable alert sounds"}
            style={{
              background: "none",
              border: `1px solid ${soundEnabled ? "var(--accent-blue)" : "var(--border)"}`,
              color: soundEnabled ? "var(--accent-blue)" : "var(--text-secondary)",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 3,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
          >
            {soundEnabled ? "SND ON" : "SND OFF"}
          </button>
          <span
            style={{
              color: "var(--text-secondary)",
              fontWeight: 400,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          >
            {lastUpdated}
          </span>
          <span
            style={{
              color: "var(--text-secondary)",
              fontWeight: 400,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
            }}
          >
            {events.length}
          </span>
        </div>
      </div>

      {/* Event list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", padding: "4px 0", position: "relative", zIndex: 1 }}
      >
        {events.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              letterSpacing: 1,
            }}
          >
            AWAITING EVENTS...
          </div>
        )}
        {events.map((evt, idx) => {
          const isNew = newIds.has(evt.id);
          const isHighSeverity = evt.severity >= 8;
          return (
            <div
              key={evt.id}
              style={{
                padding: "9px 14px",
                borderLeft: `3px solid ${isHighSeverity ? "var(--accent-red)" : severityColor(evt.severity)}`,
                marginBottom: 1,
                background: isNew
                  ? "rgba(56, 139, 253, 0.06)"
                  : "var(--bg-card)",
                animation: isNew ? "slideIn 0.4s ease" : undefined,
                animationDelay: isNew ? `${idx * 30}ms` : undefined,
                animationFillMode: "backwards",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 3,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isNew && (
                    <span
                      style={{
                        fontSize: 8,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background: "var(--accent-blue)",
                        color: "#fff",
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        animation: "pulse 1s ease-in-out 3",
                      }}
                    >
                      NEW
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {formatTimestamp(evt.timestamp)}{" "}
                    <span style={{ opacity: 0.5 }}>({timeAgo(evt.timestamp)})</span>
                    {" "}&middot; {evt.channel_name}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 2,
                      background: `${TYPE_COLORS[evt.event_type] ?? "#555"}22`,
                      color: TYPE_COLORS[evt.event_type] ?? "#888",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontFamily: "var(--font-mono)",
                      border: `1px solid ${TYPE_COLORS[evt.event_type] ?? "#555"}44`,
                    }}
                  >
                    {evt.event_type}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 2,
                      background: isHighSeverity ? "var(--accent-red)" : "transparent",
                      color: isHighSeverity ? "#fff" : severityColor(evt.severity),
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      border: isHighSeverity ? "none" : `1px solid ${severityColor(evt.severity)}44`,
                    }}
                  >
                    {evt.severity}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--text-primary)",
                  opacity: 0.9,
                }}
              >
                {evt.summary}
                {(evt.report_count ?? 1) > 1 && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      padding: "1px 5px",
                      borderRadius: 2,
                      background: "rgba(88,166,255,0.12)",
                      color: "var(--accent-blue)",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                    }}
                  >
                    {evt.report_count} sources
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
