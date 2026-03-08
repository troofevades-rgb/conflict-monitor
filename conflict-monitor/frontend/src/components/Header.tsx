import { useEffect, useState } from "react";

interface HeaderProps {
  isConnected: boolean;
  eventCount: number;
  aircraftCount: number;
  vesselCount: number;
  satelliteCount: number;
  demoMode: boolean;
}

function formatUTCTime(): string {
  const now = new Date();
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const day = String(now.getUTCDate()).padStart(2, "0");
  const month = months[now.getUTCMonth()];
  const year = now.getUTCFullYear();
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");
  return `${day} ${month} ${year} | ${hours}:${minutes}:${seconds} UTC`;
}

export function Header({
  isConnected,
  eventCount,
  aircraftCount,
  vesselCount,
  satelliteCount,
  demoMode,
}: HeaderProps) {
  const [utcTime, setUtcTime] = useState(formatUTCTime);

  useEffect(() => {
    const interval = setInterval(() => setUtcTime(formatUTCTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="panel"
      style={{
        gridArea: "header",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left: Title + Subtitle + Demo Badge */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <h1
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 4,
            fontFamily: "var(--font-sans)",
            color: "var(--text-primary)",
          }}
        >
          CONFLICT MONITOR
        </h1>
        <span
          style={{
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          REAL-TIME OSINT INTELLIGENCE
        </span>
        {demoMode && (
          <span
            style={{
              fontSize: 8,
              padding: "2px 6px",
              borderRadius: 2,
              background: "rgba(210, 153, 34, 0.2)",
              color: "var(--accent-yellow)",
              fontWeight: 700,
              letterSpacing: 1,
              fontFamily: "var(--font-mono)",
            }}
          >
            DEMO
          </span>
        )}
      </div>

      {/* Center: UTC Clock */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--accent-blue)",
          letterSpacing: 1,
          opacity: 0.9,
        }}
      >
        {utcTime}
      </div>

      {/* Right: Counts + Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-secondary)",
            letterSpacing: 1,
          }}
        >
          <span>{eventCount} EVT</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{aircraftCount} AC</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{vesselCount} VES</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{satelliteCount} SAT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isConnected
                ? "var(--accent-green)"
                : "var(--accent-red)",
              animation: isConnected
                ? "statusPulse 2s ease-in-out infinite"
                : undefined,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 1,
              color: isConnected ? "var(--accent-green)" : "var(--accent-red)",
            }}
          >
            {isConnected ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}
