import { DeliveryJob, DeliveryStatus, OrderStatus } from "@/api/types";

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  OPEN: "Waiting for a rider",
  ASSIGNED: "Rider heading to store",
  PICKED_UP: "On the way to customer",
  ARRIVED: "Rider at customer",
  DELIVERED: "Delivered",
  CANCELLED: "Recalled",
};

export const DELIVERY_STYLE: Record<DeliveryStatus, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  PICKED_UP: "bg-purple-100 text-purple-700",
  ARRIVED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "Order received",
  PREPARING: "Preparing",
  AWAITING_RIDER: "Waiting for rider",
  RIDER_ASSIGNED: "Rider assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  READY: "Ready",
  CANCELLED: "Cancelled",
};

export const VEHICLE_LABEL: Record<string, string> = {
  MOTORBIKE: "🏍️ Motorbike",
  BICYCLE: "🚲 Bicycle",
  CAR: "🚗 Car",
  ON_FOOT: "🚶 On foot",
};

/** Google Maps turn-by-turn directions to a point (opens the Maps app on phones). */
export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

/** Directions to the drop-off: exact coords when the customer shared them, else the typed address. */
export const dropoffDirectionsUrl = (job: DeliveryJob) =>
  job.dropoffLat != null && job.dropoffLng != null
    ? directionsUrl(job.dropoffLat, job.dropoffLng)
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.dropoffAddress)}`;

export function timeAgo(iso?: string | null): string {
  if (!iso) return "never";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export const timeOnly = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "—";

/** "±8 m" with a warning tone when the customer's GPS fix was poor. */
export function accuracyLabel(m?: number | null): { text: string; poor: boolean } | null {
  if (m == null) return null;
  return { text: `±${Math.round(m)} m`, poor: m > 50 };
}
