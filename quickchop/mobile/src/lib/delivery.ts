import { Coords } from "@/hooks/useDeviceLocation";
import { currentConfig } from "@/store/config";

/** Where orders are cooked / dispatched from. Admin-editable via settings
 *  (GET /api/config), so it updates if the restaurant relocates. */
export function storeCoords(): Coords {
  const { storeLat, storeLng } = currentConfig();
  return { latitude: storeLat, longitude: storeLng };
}

const PREP_MINUTES = 15; // kitchen prep before a rider leaves
const AVG_SPEED_KMH = 22; // city delivery bike average

/** Great-circle distance between two points in kilometres (Haversine). */
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Estimated delivery time (prep + travel) in minutes, given the customer coords. */
export function estimateEtaMinutes(customer: Coords | null): number | null {
  if (!customer) return null;
  const km = distanceKm(storeCoords(), customer);
  // Out of the local delivery area (or a simulator far from the store): fall
  // back to a friendly default rather than an absurd cross-continent ETA.
  if (km > 40) return 30;
  const travel = (km / AVG_SPEED_KMH) * 60;
  const total = PREP_MINUTES + travel;
  // round to the nearest 5 for a friendly "20 min" / "35 min" feel, capped sanely
  return Math.min(60, Math.max(15, Math.round(total / 5) * 5));
}

/** Friendly ETA label, e.g. "30 min". Falls back while location is resolving. */
export function etaLabel(customer: Coords | null): string {
  const mins = estimateEtaMinutes(customer);
  return mins ? `${mins} min` : "25–35 min";
}

// --- Distance-based delivery fee. MUST stay identical to OrderService.deliveryFeeFor on
//     the server, which is what the customer is actually charged. The rates come from
//     the admin settings (GET /api/config); the road factor from server config. ---

/** Server default when an older backend doesn't send deliveryRoadFactor. */
const DEFAULT_ROAD_FACTOR = 1.35;

/** Fee for a straight-line distance: converted to road km, the base covers the first
 *  `deliveryIncludedKm`, per-km applies to whole km beyond that, capped at the max. */
export function computeDeliveryFee(straightKm: number): number {
  const { deliveryBaseFee, deliveryPerKm, deliveryMaxFee, deliveryIncludedKm, deliveryRoadFactor } = currentConfig();
  const roadKm = Math.max(0, straightKm) * (deliveryRoadFactor ?? DEFAULT_ROAD_FACTOR);
  const chargeableKm = Math.max(0, Math.ceil(roadKm) - (deliveryIncludedKm ?? 0));
  const fee = Math.min(deliveryMaxFee, deliveryBaseFee + deliveryPerKm * chargeableKm);
  return Math.round(fee * 100) / 100;
}

/** Fee from the store to the customer coords, or 0 once the subtotal reaches the
 *  free-delivery threshold. null only while the location is still resolving. */
export function estimateDeliveryFee(customer: Coords | null, subtotal?: number): number | null {
  const { freeDeliveryThreshold } = currentConfig();
  if (subtotal != null && freeDeliveryThreshold > 0 && subtotal >= freeDeliveryThreshold) return 0;
  if (!customer) return null;
  return computeDeliveryFee(distanceKm(storeCoords(), customer));
}

/** Whether the customer is inside the delivery area (within maxDeliveryKm of the
 *  store — i.e. Accra). Unknown location returns true so we don't block the UI;
 *  the backend re-checks when coords are sent. */
export function withinDeliveryArea(customer: Coords | null): boolean {
  if (!customer) return true;
  return distanceKm(storeCoords(), customer) <= currentConfig().maxDeliveryKm;
}
