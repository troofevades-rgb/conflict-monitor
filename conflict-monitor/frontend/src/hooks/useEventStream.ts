import { useCallback, useEffect, useRef, useState } from "react";
import type { ConflictEvent, EventWSMessage } from "../types/event";

const MAX_EVENTS = 200;
const RECONNECT_DELAY = 3000;
const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";
const WS_URL = API_BASE.replace(/^http/, "ws") + "/ws/events";
const REST_URL = `${API_BASE}/events?limit=50`;

export function useEventStream() {
  const [events, setEvents] = useState<ConflictEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);

    ws.onmessage = (e) => {
      try {
        const msg: EventWSMessage = JSON.parse(e.data);
        if (msg.type === "new_event") {
          setEvents((prev) =>
            [msg.event, ...prev]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, MAX_EVENTS),
          );
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();
  }, []);

  // Fetch historical events on mount
  useEffect(() => {
    fetch(REST_URL)
      .then((r) => r.json())
      .then((data: ConflictEvent[]) => setEvents(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const latestEvent = events[0] ?? null;

  return { events, isConnected, latestEvent };
}
