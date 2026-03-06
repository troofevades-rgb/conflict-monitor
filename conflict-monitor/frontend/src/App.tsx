import { EscalationGauge } from "./components/EscalationGauge";
import { Header } from "./components/Header";
import { LiveFeed } from "./components/LiveFeed";
import { MapPanel } from "./components/MapPanel";
import { useEventStream } from "./hooks/useEventStream";
import { useTracking } from "./hooks/useTracking";

export default function App() {
  const { events, isConnected } = useEventStream();
  const { aircraft, tleData, jammingZones, vessels } = useTracking();

  return (
    <div className="app-grid">
      <Header
        isConnected={isConnected}
        eventCount={events.length}
        aircraftCount={aircraft.filter((a) => !a.on_ground).length}
        vesselCount={vessels.length}
        satelliteCount={tleData.length}
      />
      <MapPanel events={events} aircraft={aircraft} vessels={vessels} tleData={tleData} jammingZones={jammingZones} />
      <LiveFeed events={events} />
      <EscalationGauge events={events} />
    </div>
  );
}
