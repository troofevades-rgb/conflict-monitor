import { EscalationGauge } from "./components/EscalationGauge";
import { Header } from "./components/Header";
import { LiveFeed } from "./components/LiveFeed";
import { MapPanel } from "./components/MapPanel";
import { useEventStream } from "./hooks/useEventStream";

export default function App() {
  const { events, isConnected } = useEventStream();

  return (
    <div className="app-grid">
      <Header isConnected={isConnected} eventCount={events.length} />
      <MapPanel events={events} />
      <LiveFeed events={events} />
      <EscalationGauge events={events} />
    </div>
  );
}
