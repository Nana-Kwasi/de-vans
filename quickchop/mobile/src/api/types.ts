export type OrderStatus =
  | "ORDER_RECEIVED"
  | "PREPARING"
  | "AWAITING_RIDER"
  | "RIDER_ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "READY"
  | "CANCELLED";

export type MenuCategory = "rice" | "chicken" | "salad" | "drinks";

export interface AppConfig {
  businessName: string;
  acceptingOrders: boolean;
  closedMessage: string;
  contactPhone: string;
  storeAddress: string;
  announcementEnabled: boolean;
  announcementText: string;
  promoEnabled: boolean;
  promoTitle: string;
  promoText: string;
  promoCta: string;
  /** Null falls back to the featured dish's own photo. */
  promoImageUrl?: string | null;
  deliveryBaseFee: number;
  deliveryPerKm: number;
  deliveryMaxFee: number;
  /** The base fee covers this many km; per-km charging starts after them. */
  deliveryIncludedKm?: number;
  /** Straight-line km × this = billed road km (server config; older servers omit it). */
  deliveryRoadFactor?: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  maxDeliveryKm: number;
  storeLat: number;
  storeLng: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  photoUrl?: string | null;
  category?: MenuCategory;
  available: boolean;
  featured?: boolean;
  createdAt?: string;
  /** Drinks only: "soft" (bottled/canned) or "local" (sobolo, ginger, watermelon…). */
  drinkType?: DrinkType | null;
}

export type DrinkType = "soft" | "local";

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addOns?: string | null;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  changedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  pickup: boolean;
  deliveryAddress: string;
  deliveryTimeNote?: string | null;
  kitchenNote?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
  history: OrderStatusEvent[];
  /** When payment was confirmed; null/absent = not paid yet. */
  paidAt?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAccuracyM?: number | null;
  contactPhone?: string | null;
  delivery?: OrderDelivery | null;
}

export type DeliveryStatus = "OPEN" | "ASSIGNED" | "PICKED_UP" | "ARRIVED" | "DELIVERED" | "CANCELLED";

/** The rider delivering an order, plus the delivery timeline. */
export interface OrderDelivery {
  id: string;
  status: DeliveryStatus;
  riderId?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  vehicleType?: string | null;
  vehiclePlate?: string | null;
  dispatchedAt: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  arrivedAt?: string | null;
  deliveredAt?: string | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  at?: string | null;
}

/** GET /api/orders/{id}/tracking — riderLocation is only present while a rider holds the order. */
export interface OrderTracking {
  orderId: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  delivery?: OrderDelivery | null;
  riderLocation?: GeoPoint | null;
  dropoff?: GeoPoint | null;
  store: GeoPoint;
  /** Code to give the rider at hand-over; null once delivered. */
  deliveryPin?: string | null;
  riderDistanceKm?: number | null;
  etaMinutes?: number | null;
}

export interface Customer {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  defaultAddress?: string | null;
  createdAt: string;
}

export interface Policy {
  id: string;
  type: string;
  slug: string;
  version: number;
  title: string;
  /** Markdown */
  content: string;
  changeSummary?: string | null;
  publishedAt: string;
}

export interface PolicyStatus {
  policy: Policy;
  accepted: boolean;
  acceptedAt?: string | null;
}

export interface PaymentInitResponse {
  authorizationUrl: string;
  reference: string;
  accessCode: string;
}
