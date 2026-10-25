import { api } from "./client";
import { AppConfig, Customer, MenuItem, Order, OrderTracking, PaymentInitResponse, PolicyStatus } from "./types";

export const MenuApi = {
  list: () => api.get<MenuItem[]>("/api/menu").then((r) => r.data),
};

export const ConfigApi = {
  get: () => api.get<AppConfig>("/api/config").then((r) => r.data),
};

export const CustomerApi = {
  createProfile: (body: {
    fullName: string;
    email: string;
    phoneNumber?: string;
    defaultAddress?: string;
  }) => api.post<Customer>("/api/customers", body).then((r) => r.data),
  me: () => api.get<Customer>("/api/customers/me").then((r) => r.data),
  registerFcmToken: (fcmToken: string) =>
    api.put("/api/customers/me/fcm-token", { fcmToken }).then((r) => r.data),
};

export interface PlaceOrderBody {
  items: { menuItemId: string; quantity: number; addOns?: string }[];
  deliveryAddress: string;
  deliveryTimeNote?: string;
  kitchenNote?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  /** GPS accuracy (metres) of the drop-off point, so the rider knows how far to trust it. */
  deliveryAccuracyM?: number;
  contactPhone?: string;
  pickup?: boolean;
}

export const OrderApi = {
  place: (body: PlaceOrderBody) =>
    api.post<Order>("/api/orders", body).then((r) => r.data),
  mine: () => api.get<Order[]>("/api/orders/me").then((r) => r.data),
  get: (id: string) => api.get<Order>(`/api/orders/${id}`).then((r) => r.data),
  tracking: (id: string) => api.get<OrderTracking>(`/api/orders/${id}/tracking`).then((r) => r.data),
  updateDropoff: (id: string, body: { lat: number; lng: number; accuracyM?: number }) =>
    api.patch<Order>(`/api/orders/${id}/dropoff`, body).then((r) => r.data),
};

export const PolicyApi = {
  status: () => api.get<PolicyStatus[]>("/api/customers/me/policies").then((r) => r.data),
  accept: (policyIds: string[]) =>
    api.post<PolicyStatus[]>("/api/customers/me/policies/accept", { policyIds }).then((r) => r.data),
};

/** Public web pages for each policy (also the links given to the app stores). */
export const LEGAL_URL = (slug: "customer-privacy" | "customer-terms") => `https://qookaqooks.com/legal/${slug}`;

export const PaymentApi = {
  initialize: (body: { orderId: string; method: string; email: string }) =>
    api.post<PaymentInitResponse>("/api/payments/paystack/initialize", body).then((r) => r.data),
  verify: (reference: string) =>
    api.get(`/api/payments/paystack/verify/${reference}`).then((r) => r.data),
};

export const SupportApi = {
  create: (body: { category: string; orderNumber?: string; message: string }) =>
    api.post("/api/support", body).then((r) => r.data),
};

export const ReviewApi = {
  create: (body: { orderId: string; rating: number; comment?: string }) =>
    api.post("/api/reviews", body).then((r) => r.data),
};
