export interface ConflictEvent {
  id: number;
  source: string;
  channel_name: string;
  raw_text: string;
  summary: string;
  event_type: "military" | "diplomatic" | "economic" | "cyber";
  severity: number;
  lat: number | null;
  lon: number | null;
  timestamp: string;
  created_at: string;
}

export interface EventWSMessage {
  type: "new_event";
  event: ConflictEvent;
}
