export type OrderStatus =
  | "ORDER_RECEIVED"
  | "PREPARING"
  | "AWAITING_RIDER"
  | "RIDER_ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "READY"
  | "CANCELLED";

export interface AppSettings {
  businessName: string;
  acceptingOrders: boolean;
  closedMessage: string;
  contactPhone: string;
  storeAddress: string;
  announcementEnabled: boolean;
  promoEnabled: boolean;
  promoTitle: string;
  promoText: string;
  promoCta: string;
  promoImageUrl?: string | null;
  announcementText: string;
  deliveryBaseFee: number;
  deliveryPerKm: number;
  deliveryMaxFee: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  maxDeliveryKm: number;
  storeLat: number;
  storeLng: number;
}

export type MenuCategory = "rice" | "chicken" | "salad" | "drinks";

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  photoUrl?: string | null;
  category: MenuCategory;
  available: boolean;
  featured?: boolean;
  /** Drinks only: bottled/canned soft drinks vs Ghanaian local drinks. */
  drinkType?: DrinkType | null;
}

export type DrinkType = "soft" | "local";

export interface Review {
  id: string;
  orderId?: string | null;
  customerId?: string | null;
  orderNumber?: string | null;
  name?: string | null;
  rating: number;
  comment?: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addOns?: string | null;
}

export interface Order {
  id: string;
  customerId?: string | null;
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
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAccuracyM?: number | null;
  contactPhone?: string | null;
  /** Present once the order has been sent to riders. */
  delivery?: OrderDelivery | null;
  customerName?: string | null;
  history?: { status: OrderStatus; changedAt: string }[];
  /** When payment was confirmed; null = unpaid. */
  paidAt?: string | null;
}

export interface Payment {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  status: string;
  provider: string;
  providerReference?: string | null;
}

export interface SearchOrderHit {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerName?: string | null;
  total: number;
  pickup: boolean;
  createdAt: string;
}

export interface SearchResults {
  orders: SearchOrderHit[];
  customers: { id: string; fullName: string; email?: string | null; phoneNumber?: string | null; orderCount: number }[];
  menu: MenuItem[];
  riders: { id: string; fullName: string; phoneNumber: string; active: boolean; online: boolean }[];
}

export type CustomerSegment = "NEW" | "RETURNING" | "LOYAL";

export interface CustomerInsights {
  customer: Customer;
  segment: CustomerSegment;
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  activeCount: number;
  totalSpent: number;
  avgOrderValue: number;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
  daysSinceLastOrder?: number | null;
  deliveryCount: number;
  pickupCount: number;
  favouriteItems: { name: string; quantity: number }[];
  avgRating?: number | null;
  reviewCount: number;
  openTickets: number;
  recentOrders: SearchOrderHit[];
}

export interface AdminOrderDetail {
  order: Order;
  customer: CustomerInsights;
  payments: Payment[];
  paid: boolean;
  review?: Review | null;
  delivery?: DeliveryJob | null;
}

export type DeliveryStatus = "OPEN" | "ASSIGNED" | "PICKED_UP" | "ARRIVED" | "DELIVERED" | "CANCELLED";

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

/** A delivery job as riders and admins see it (customer contact is null in the open pool). */
export interface DeliveryJob {
  id: string;
  orderId: string;
  orderNumber: string;
  status: DeliveryStatus;
  orderStatus: OrderStatus;
  riderFee: number;
  /** Admin only — riders never handle order money, so these are null for them. */
  orderSubtotal?: number | null;
  orderDeliveryFee?: number | null;
  orderTotal?: number | null;
  paid?: boolean | null;
  paymentMethod?: string | null;
  pickupName: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  storePhone?: string | null;
  dropoffAddress: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffAccuracyM?: number | null;
  tripKm?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryTimeNote?: string | null;
  customerNote?: string | null;
  dispatchNote?: string | null;
  items: OrderItem[];
  itemCount: number;
  riderId?: string | null;
  riderName?: string | null;
  riderPhone?: string | null;
  riderLocation?: GeoPoint | null;
  pinAttempts: number;
  pinLocked: boolean;
  completedByAdmin: boolean;
  dispatchedAt: string;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  arrivedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
}

export interface DeliveryRoute {
  job: DeliveryJob;
  path: GeoPoint[];
}

export type VehicleType = "MOTORBIKE" | "BICYCLE" | "CAR" | "ON_FOOT";

export interface RiderAdmin {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  vehicleType: VehicleType;
  vehiclePlate?: string | null;
  notes?: string | null;
  active: boolean;
  online: boolean;
  mustChangePassword: boolean;
  locked: boolean;
  lastLocation?: GeoPoint | null;
  activeDeliveries: number;
  deliveredCount: number;
  totalEarned: number;
  createdAt: string;
}

export interface RiderCredentials {
  rider: RiderAdmin;
  temporaryPassword: string;
}

export interface RiderProfile {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string | null;
  vehicleType: VehicleType;
  vehiclePlate?: string | null;
  online: boolean;
  mustChangePassword: boolean;
}

export interface RiderSummary {
  todayCount: number;
  todayEarnings: number;
  weekCount: number;
  weekEarnings: number;
  totalCount: number;
  totalEarnings: number;
}

export interface Customer {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  defaultAddress?: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  ordersToday: number;
  revenueToday: number;
  ordersThisWeek: number;
  revenueThisWeek: number;
  ordersInRange: number;
  revenueInRange: number;
}

export type SupportStatus = "OPEN" | "RESOLVED";

export interface SupportTicket {
  id: string;
  customerId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  category: string;
  orderNumber?: string | null;
  message: string;
  status: SupportStatus;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AdminInviteResult {
  id: string;
  email: string;
  fullName: string | null;
  temporaryPassword: string;
  /** False when email is not configured, so the password must be passed on by hand. */
  emailed: boolean;
}

// ---------- Policies & consent ----------
export type PolicyAudience = "CUSTOMER" | "RIDER";
export type PolicyTypeName = "CUSTOMER_PRIVACY" | "CUSTOMER_TERMS" | "RIDER_PRIVACY" | "RIDER_TERMS";

export interface Policy {
  id: string;
  type: PolicyTypeName;
  slug: string;
  audience: PolicyAudience;
  version: number;
  title: string;
  /** Markdown */
  content: string;
  contentSha256: string;
  changeSummary?: string | null;
  publishedAt: string;
}

export interface PolicyVersion {
  id: string;
  version: number;
  title: string;
  contentSha256: string;
  changeSummary?: string | null;
  publishedAt: string;
}

export interface PolicyStatus {
  policy: Policy;
  accepted: boolean;
  acceptedAt?: string | null;
}

export interface AdminPolicy {
  type: PolicyTypeName;
  slug: string;
  audience: PolicyAudience;
  current?: Policy | null;
  versions: PolicyVersion[];
  acceptedCurrent: number;
  totalUsers: number;
}

export interface ConsentCell {
  type: PolicyTypeName;
  currentVersion: number;
  acceptedVersion?: number | null;
  acceptedAt?: string | null;
  upToDate: boolean;
}

export interface ConsentRow {
  subjectId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  joinedAt: string;
  allAccepted: boolean;
  policies: ConsentCell[];
}

export interface ConsentTable {
  audience: PolicyAudience;
  currentPolicies: PolicyVersion[];
  totalUsers: number;
  fullyAccepted: number;
  rows: ConsentRow[];
}

export interface AcceptanceProof {
  id: string;
  policyType: PolicyTypeName;
  policyTitle: string;
  version: number;
  currentVersion: boolean;
  acceptedAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  acceptedSha256: string;
  policySha256: string;
  hashMatches: boolean;
  policyId: string;
}

export interface ConsentProof {
  audience: PolicyAudience;
  subjectId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  acceptances: AcceptanceProof[];
}
