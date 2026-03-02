import { useCallback, useMemo, useState } from "react";
import Map, { Marker, Popup } from "react-map-gl";
import type { ConflictEvent } from "../types/event";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const EVENT_COLORS: Record<string, string> = {
  military: "#f85149",
  diplomatic: "#58a6ff",
  economic: "#d29922",
  cyber: "#bc8cff",
};

interface MapPanelProps {
  events: ConflictEvent[];
}

export function MapPanel({ events }: MapPanelProps) {
  const [selected, setSelected] = useState<ConflictEvent | null>(null);

  const geoEvents = useMemo(
    () => events.filter((e) => e.lat != null && e.lon != null),
    [events],
  );

  const handleMarkerClick = useCallback((e: ConflictEvent) => {
    setSelected(e);
  }, []);

  return (
    <div className="panel" style={{ gridArea: "map", position: "relative" }}>
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
            <div
              style={{
                width: 8 + evt.severity * 2.5,
                height: 8 + evt.severity * 2.5,
                borderRadius: "50%",
                background: EVENT_COLORS[evt.event_type] ?? "#888",
                opacity: 0.85,
                border: "2px solid rgba(255,255,255,0.3)",
                cursor: "pointer",
                transition: "transform 0.2s",
              }}
              title={evt.summary}
            />
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
            <div style={{ color: "#1c2128", fontSize: 13, lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {selected.summary}
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>
                {selected.event_type.toUpperCase()} | Severity:{" "}
                {selected.severity}/10
              </div>
              <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
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
          background: "rgba(13,17,23,0.85)",
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 11,
          display: "flex",
          gap: 12,
        }}
      >
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
              }}
            />
            {type}
          </div>
        ))}
      </div>
    </div>
  );
}
