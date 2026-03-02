interface HeaderProps {
  isConnected: boolean;
  eventCount: number;
}

export function Header({ isConnected, eventCount }: HeaderProps) {
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>
          CONFLICT MONITOR
        </h1>
        <span
          style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}
        >
          Israel / US & Iran Theatre
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {eventCount} events tracked
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isConnected ? "var(--accent-green)" : "var(--accent-red)",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {isConnected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>
    </header>
  );
}
