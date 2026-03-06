import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Popup } from "react-map-gl";
import type { ConflictEvent } from "../types/event";
import type { Aircraft, JammingZone, TLERecord, Vessel } from "../hooks/useTracking";
import { GlobeView } from "./GlobeView";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const EVENT_COLORS: Record<string, string> = {
  military: "#f85149",
  diplomatic: "#58a6ff",
  economic: "#d29922",
  cyber: "#bc8cff",
};

interface MapPanelProps {
  events: ConflictEvent[];
  aircraft: Aircraft[];
  vessels: Vessel[];
  tleData: TLERecord[];
  jammingZones: JammingZone[];
}

/** Small diamond marker with type color and severity ring */
function PingMarker({
  evt,
  isNew,
  onClick,
}: {
  evt: ConflictEvent;
  isNew: boolean;
  onClick: () => void;
}) {
  const color = EVENT_COLORS[evt.event_type] ?? "#888";
  const isHighSeverity = evt.severity >= 8;
  // Core size: 6-10px based on severity
  const dotSize = 6 + evt.severity * 0.4;

  return (
    <div
      style={{
        position: "relative",
        width: 24,
        height: 24,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClick}
      title={evt.summary}
    >
      {/* Radar ping on new events */}
      {isNew && (
        <div
          style={{
            position: "absolute",
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: `1.5px solid ${isHighSeverity ? "#f85149" : color}`,
            animation: `${isHighSeverity ? "radarPingRed" : "radarPing"} 1.5s ease-out forwards`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Outer severity ring (only for severity >= 5) */}
      {evt.severity >= 5 && (
        <div
          style={{
            position: "absolute",
            width: dotSize + 6,
            height: dotSize + 6,
            borderRadius: "50%",
            border: `1px solid ${color}`,
            opacity: 0.3 + (evt.severity / 10) * 0.4,
          }}
        />
      )}

      {/* Core diamond dot */}
      <div
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: isHighSeverity ? "2px" : "50%",
          transform: isHighSeverity ? "rotate(45deg)" : undefined,
          background: color,
          boxShadow: `0 0 ${3 + evt.severity}px ${color}88`,
        }}
      />
    </div>
  );
}

export function MapPanel({ events, aircraft, vessels, tleData, jammingZones }: MapPanelProps) {
  const [selected, setSelected] = useState<ConflictEvent | null>(null);
  const [newEventIds, setNewEventIds] = useState<Set<number>>(new Set());
  const prevIdsRef = useRef<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  const geoEvents = useMemo(
    () => events.filter((e) => e.lat != null && e.lon != null),
    [events],
  );

  const airborneAircraft = useMemo(
    () => aircraft.filter((a) => !a.on_ground),
    [aircraft],
  );

  // Track which events are new for ping animation
  useEffect(() => {
    const currentIds = new Set(geoEvents.map((e) => e.id));
    const fresh = new Set<number>();
    for (const id of currentIds) {
      if (!prevIdsRef.current.has(id)) fresh.add(id);
    }
    if (fresh.size > 0) {
      setNewEventIds(fresh);
      const timer = setTimeout(() => setNewEventIds(new Set()), 2000);
      prevIdsRef.current = currentIds;
      return () => clearTimeout(timer);
    }
    prevIdsRef.current = currentIds;
  }, [geoEvents]);

  const handleMarkerClick = useCallback((e: ConflictEvent) => {
    setSelected(e);
  }, []);

  return (
    <div className="panel" style={{ gridArea: "map", position: "relative" }}>
      {/* View mode toggle */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 10,
          display: "flex",
          gap: 1,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: 1,
        }}
      >
        {(["2d", "3d"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "4px 10px",
              background:
                viewMode === mode
                  ? "rgba(88,166,255,0.15)"
                  : "rgba(10,14,20,0.8)",
              border: `1px solid ${viewMode === mode ? "var(--accent-blue)" : "var(--border)"}`,
              color:
                viewMode === mode
                  ? "var(--accent-blue)"
                  : "var(--text-secondary)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "inherit",
              letterSpacing: "inherit",
              fontWeight: 600,
              borderRadius: mode === "2d" ? "3px 0 0 3px" : "0 3px 3px 0",
            }}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      {viewMode === "2d" ? (
        <>
          <Map
            initialViewState={{
              longitude: 47,
              latitude: 32,
              zoom: 4.5,
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {/* Conflict event markers */}
            {geoEvents.map((evt) => (
              <Marker
                key={evt.id}
                longitude={evt.lon!}
                latitude={evt.lat!}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  handleMarkerClick(evt);
                }}
              >
                <PingMarker
                  evt={evt}
                  isNew={newEventIds.has(evt.id)}
                  onClick={() => handleMarkerClick(evt)}
                />
              </Marker>
            ))}

            {/* Jamming zones */}
            {jammingZones.map((z, i) => (
              <Marker
                key={`jam-${i}`}
                longitude={z.lon}
                latitude={z.lat}
                anchor="center"
              >
                <div
                  title={`GPS JAMMING | ${z.aircraft_count} MLAT aircraft`}
                  style={{
                    width: Math.max(30, z.radius_km / 2),
                    height: Math.max(30, z.radius_km / 2),
                    borderRadius: "4px",
                    background: `rgba(255, 32, 32, ${0.15 + z.intensity * 0.2})`,
                    border: "1px solid rgba(255, 64, 64, 0.5)",
                    transform: "rotate(45deg)",
                    pointerEvents: "none",
                  }}
                />
              </Marker>
            ))}

            {/* Aircraft markers with callsigns */}
            {airborneAircraft.map((ac, i) => (
              <Marker
                key={`ac-${ac.icao24 || i}`}
                longitude={ac.lon}
                latitude={ac.lat}
                anchor="center"
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}
                  title={`${ac.callsign || ac.icao24} | ${ac.origin_country}${ac.altitude ? ` | ${Math.round(ac.altitude)}m` : ""}`}
                >
                  {/* Heading-oriented aircraft dot */}
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#58d0ff",
                      opacity: 0.85,
                      boxShadow: "0 0 4px rgba(88,208,255,0.5)",
                    }}
                  />
                  {/* Callsign label */}
                  {ac.callsign && (
                    <span
                      style={{
                        fontSize: 8,
                        color: "#58d0ff",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        textShadow: "0 0 4px rgba(0,0,0,0.8)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ac.callsign}
                    </span>
                  )}
                </div>
              </Marker>
            ))}

            {/* Vessel markers */}
            {vessels.map((v) => (
              <Marker
                key={`v-${v.mmsi}`}
                longitude={v.lon}
                latitude={v.lat}
                anchor="center"
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 3, pointerEvents: "none" }}
                  title={`${v.name || v.mmsi} | ${v.ship_type_name || "Vessel"}${v.speed ? ` | ${v.speed}kn` : ""}${v.destination ? ` → ${v.destination}` : ""}`}
                >
                  {/* Ship-shaped marker (rotated triangle) */}
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "3.5px solid transparent",
                      borderRight: "3.5px solid transparent",
                      borderBottom: "8px solid #40e0d0",
                      transform: `rotate(${(v.heading || 0) + 180}deg)`,
                      filter: "drop-shadow(0 0 3px rgba(64,224,208,0.5))",
                    }}
                  />
                  {/* Name label */}
                  {v.name && (
                    <span
                      style={{
                        fontSize: 7,
                        color: "#40e0d0",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        textShadow: "0 0 4px rgba(0,0,0,0.8)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.name}
                    </span>
                  )}
                </div>
              </Marker>
            ))}

            {selected && selected.lat && selected.lon && (
              <Popup
                longitude={selected.lon}
                latitude={selected.lat}
                anchor="bottom"
                onClose={() => setSelected(null)}
                closeButton
                closeOnClick={false}
                style={{ maxWidth: 280 }}
              >
                <div
                  style={{
                    color: "#c8d6e5",
                    fontSize: 12,
                    lineHeight: 1.5,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {selected.summary}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#5a6a7e",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {selected.event_type.toUpperCase()} | SEV{" "}
                    {selected.severity}/10
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#5a6a7e",
                      marginTop: 2,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {selected.channel_name} &middot;{" "}
                    {new Date(selected.timestamp).toLocaleString()}
                  </div>
                </div>
              </Popup>
            )}
          </Map>

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: "rgba(10, 14, 20, 0.9)",
              padding: "8px 12px",
              borderRadius: 4,
              fontSize: 10,
              display: "flex",
              gap: 12,
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              letterSpacing: 0.5,
            }}
          >
            {Object.entries(EVENT_COLORS).map(([type, color]) => (
              <div
                key={type}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    boxShadow: `0 0 4px ${color}66`,
                  }}
                />
                <span
                  style={{
                    color: "var(--text-secondary)",
                    textTransform: "uppercase",
                  }}
                >
                  {type}
                </span>
              </div>
            ))}
            {airborneAircraft.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#58d0ff",
                    boxShadow: "0 0 4px rgba(88,208,255,0.6)",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  AIRCRAFT ({airborneAircraft.length})
                </span>
              </div>
            )}
            {vessels.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "4px solid transparent",
                    borderRight: "4px solid transparent",
                    borderBottom: "8px solid #40e0d0",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  VESSELS ({vessels.length})
                </span>
              </div>
            )}
            {jammingZones.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: "rgba(255,32,32,0.6)",
                    border: "1px solid #ff4040",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  GPS JAMMING ({jammingZones.length})
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <GlobeView events={events} aircraft={aircraft} vessels={vessels} tleData={tleData} jammingZones={jammingZones} />

          {/* 3D overlay legend */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              background: "rgba(4, 6, 8, 0.85)",
              padding: "8px 12px",
              borderRadius: 4,
              fontSize: 10,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              letterSpacing: 0.5,
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              {Object.entries(EVENT_COLORS).map(([type, color]) => (
                <div
                  key={type}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: color,
                    }}
                  />
                  <span style={{ color: "var(--text-secondary)", textTransform: "uppercase" }}>
                    {type}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#f0c040",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  AIRCRAFT ({aircraft.filter((a) => !a.on_ground).length})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "3px solid transparent",
                    borderRight: "3px solid transparent",
                    borderBottom: "6px solid #40e0d0",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  VESSELS ({vessels.length})
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00e5a0",
                  }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                  SATELLITES ({tleData.length})
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
