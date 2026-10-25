import { useEffect } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { GeoPoint } from "@/api/types";

/** Coloured pin markers built from HTML, so no image assets need bundling. */
const pin = (emoji: string, bg: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${bg};width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,.25);border:2px solid #fff"><span style="transform:rotate(45deg);font-size:16px">${emoji}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
  });

const ICONS = {
  store: pin("🍳", "#F26A21"),
  dropoff: pin("🏠", "#1BA672"),
  rider: pin("🛵", "#2563EB"),
  riderIdle: pin("🛵", "#9A9DA6"),
};

export interface MapMarker {
  key: string;
  kind: keyof typeof ICONS;
  point: GeoPoint;
  label?: string;
}

/** Fits the view to every marker whenever the set of positions changes. */
function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  const sig = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, map]);
  return null;
}

/**
 * OpenStreetMap-based map for deliveries: store, customer drop-off (with its GPS accuracy
 * circle), riders and an optional travelled path.
 */
export function DeliveryMap({
  markers,
  path,
  height = 280,
  className = "",
}: {
  markers: MapMarker[];
  path?: GeoPoint[];
  height?: number;
  className?: string;
}) {
  const points = markers.map((m) => m.point);
  const center = points[0] ?? { lat: 5.6072, lng: -0.2838 };
  return (
    <div className={`overflow-hidden rounded-2xl border border-hairline ${className}`} style={{ height }}>
      <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {path && path.length > 1 && (
          <Polyline positions={path.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#2563EB", weight: 4, opacity: 0.7 }} />
        )}
        {markers.map((m) => (
          <Marker key={m.key} position={[m.point.lat, m.point.lng]} icon={ICONS[m.kind]}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
        {markers
          .filter((m) => m.kind === "dropoff" && m.point.accuracyM && m.point.accuracyM > 15)
          .map((m) => (
            <Circle key={`${m.key}-acc`} center={[m.point.lat, m.point.lng]} radius={m.point.accuracyM!} pathOptions={{ color: "#1BA672", weight: 1, fillOpacity: 0.08 }} />
          ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
