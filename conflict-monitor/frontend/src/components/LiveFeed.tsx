import { useEffect, useRef, useState } from "react";
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

interface LiveFeedProps {
  events: ConflictEvent[];
}

export function LiveFeed({ events }: LiveFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const prevCountRef = useRef(0);

  // Track newly arrived events for the "NEW" flash
  useEffect(() => {
    if (events.length > prevCountRef.current && prevCountRef.current > 0) {
      const incoming = new Set(
        events.slice(0, events.length - prevCountRef.current).map((e) => e.id),
      );
      setNewIds(incoming);
      const timer = setTimeout(() => setNewIds(new Set()), 3000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = events.length;
  }, [events]);

  useEffect(() => {
    prevCountRef.current = events.length;
  }, [events.length]);

  // Auto-scroll to top on new events
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    setAutoScroll(containerRef.current.scrollTop < 10);
  };

  const lastUpdated =
    events.length > 0
      ? `Last: ${timeAgo(events[0].timestamp)}`
      : "";

  return (
    <div
      className="panel"
      style={{
        gridArea: "feed",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          fontSize: 13,
          fontWeight: 600,
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>LIVE FEED</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "var(--text-secondary)", fontWeight: 400, fontSize: 11 }}>
            {lastUpdated}
          </span>
          <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
            {events.length} events
          </span>
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}
      >
        {events.length === 0 && (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            Waiting for events...
          </div>
        )}
        {events.map((evt) => {
          const isNew = newIds.has(evt.id);
          return (
            <div
              key={evt.id}
              style={{
                padding: "10px 16px",
                borderLeft: `3px solid ${severityColor(evt.severity)}`,
                marginBottom: 1,
                background: isNew
                  ? "rgba(56, 139, 253, 0.08)"
                  : "var(--bg-card)",
                animation: isNew ? "flashIn 0.5s ease" : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isNew && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background: "var(--accent-blue)",
                        color: "#fff",
                        fontWeight: 700,
                        animation: "pulse 1s ease-in-out 3",
                      }}
                    >
                      NEW
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {formatTimestamp(evt.timestamp)}{" "}
                    <span style={{ opacity: 0.6 }}>({timeAgo(evt.timestamp)})</span>
                    {" "}&middot; {evt.channel_name}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: TYPE_COLORS[evt.event_type] ?? "#555",
                      color: "#fff",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {evt.event_type}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "2px 6px",
                      borderRadius: 3,
                      background: severityColor(evt.severity),
                      color: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {evt.severity}/10
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>{evt.summary}</div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes flashIn {
          0% { opacity: 0; transform: translateY(-8px); background: rgba(56, 139, 253, 0.15); }
          50% { background: rgba(56, 139, 253, 0.1); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
