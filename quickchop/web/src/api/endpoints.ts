import { api } from "./client";
import {
  AdminInviteResult, AdminOrderDetail, AdminPolicy, ConsentProof, ConsentTable, Policy, AdminUser, AppSettings, CustomerInsights, SearchResults, Customer, DashboardSummary, DeliveryJob, DeliveryRoute, MenuItem,
  Order, OrderStatus, Review, RiderAdmin, RiderCredentials, SupportStatus, SupportTicket, VehicleType,
} from "./types";

export const AdminUsersApi = {
  list: () => api.get<AdminUser[]>("/api/admin/users").then((r) => r.data),
  invite: (body: { email: string; fullName: string }) =>
    api.post<AdminInviteResult>("/api/admin/users", body).then((r) => r.data),
};

export const AuthApi = {
  login: (email: string, password: string) =>
    api
      .post<{ token: string; email: string; fullName: string; mustChangePassword: boolean }>("/api/admin/login", {
        email,
        password,
      })
      .then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch("/api/admin/change-password", { currentPassword, newPassword }).then((r) => r.data),
  /** Always succeeds, whether or not the email is an admin (so it can't be used to probe accounts). */
  forgotPassword: (email: string) => api.post("/api/admin/forgot-password", { email }).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    api.post("/api/admin/reset-password", { token, newPassword }).then((r) => r.data),
};

export const OrdersApi = {
  list: (status?: OrderStatus) =>
    api
      .get<Order[]>("/api/orders", { params: status ? { status } : {} })
      .then((r) => r.data),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/api/orders/${id}/status`, { status }).then((r) => r.data),
  /** Order + payments + review + delivery + customer analytics, for the detail screen. */
  detail: (id: string) => api.get<AdminOrderDetail>(`/api/admin/orders/${id}`).then((r) => r.data),
};

export const SearchApi = {
  search: (q: string) => api.get<SearchResults>("/api/admin/search", { params: { q } }).then((r) => r.data),
};

export const MenuApi = {
  list: () => api.get<MenuItem[]>("/api/menu").then((r) => r.data),
  create: (body: Partial<MenuItem>) => api.post<MenuItem>("/api/menu", body).then((r) => r.data),
  update: (id: string, body: Partial<MenuItem>) =>
    api.patch<MenuItem>(`/api/menu/${id}`, body).then((r) => r.data),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/api/menu/upload", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.url);
  },
};

export const SupportApi = {
  list: (status?: SupportStatus) =>
    api.get<SupportTicket[]>("/api/admin/support", { params: status ? { status } : {} }).then((r) => r.data),
  updateStatus: (id: string, status: SupportStatus) =>
    api.patch<SupportTicket>(`/api/admin/support/${id}/status`, { status }).then((r) => r.data),
};

export const ReviewsApi = {
  list: () => api.get<Review[]>("/api/admin/reviews").then((r) => r.data),
};

export const DashboardApi = {
  summary: (from?: string, to?: string) =>
    api
      .get<DashboardSummary>("/api/dashboard/summary", { params: { from, to } })
      .then((r) => r.data),
};

export const CustomersApi = {
  list: () => api.get<Customer[]>("/api/admin/customers").then((r) => r.data),
  insights: (id: string) => api.get<CustomerInsights>(`/api/admin/customers/${id}/insights`).then((r) => r.data),
};

export const SettingsApi = {
  get: () => api.get<AppSettings>("/api/config").then((r) => r.data),
  update: (body: Partial<AppSettings>) =>
    api.patch<AppSettings>("/api/admin/settings", body).then((r) => r.data),
};

export interface RiderInput {
  fullName: string;
  phoneNumber: string;
  email?: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;
  notes?: string;
}

export const RidersApi = {
  list: () => api.get<RiderAdmin[]>("/api/admin/riders").then((r) => r.data),
  create: (body: RiderInput) => api.post<RiderCredentials>("/api/admin/riders", body).then((r) => r.data),
  update: (id: string, body: Partial<RiderInput>) =>
    api.patch<RiderAdmin>(`/api/admin/riders/${id}`, body).then((r) => r.data),
  setActive: (id: string, active: boolean) =>
    api.post<RiderAdmin>(`/api/admin/riders/${id}/${active ? "activate" : "deactivate"}`).then((r) => r.data),
  resetPassword: (id: string) =>
    api.post<RiderCredentials>(`/api/admin/riders/${id}/reset-password`).then((r) => r.data),
  deliveries: (id: string) => api.get<DeliveryJob[]>(`/api/admin/riders/${id}/deliveries`).then((r) => r.data),
};

export const DeliveriesApi = {
  dispatch: (orderId: string, note?: string) =>
    api.post<DeliveryJob>(`/api/admin/orders/${orderId}/dispatch`, { note }).then((r) => r.data),
  active: () => api.get<DeliveryJob[]>("/api/admin/deliveries").then((r) => r.data),
  history: (days = 7) =>
    api.get<DeliveryJob[]>("/api/admin/deliveries", { params: { history: true, days } }).then((r) => r.data),
  route: (id: string) => api.get<DeliveryRoute>(`/api/admin/deliveries/${id}`).then((r) => r.data),
  assign: (id: string, riderId: string) =>
    api.post<DeliveryJob>(`/api/admin/deliveries/${id}/assign`, { riderId }).then((r) => r.data),
  unassign: (id: string) => api.post<DeliveryJob>(`/api/admin/deliveries/${id}/unassign`).then((r) => r.data),
  recall: (id: string) => api.post<DeliveryJob>(`/api/admin/deliveries/${id}/recall`).then((r) => r.data),
  complete: (id: string) => api.post<DeliveryJob>(`/api/admin/deliveries/${id}/complete`).then((r) => r.data),
};

export const PoliciesApi = {
  /** Public — no sign-in needed. */
  current: (audience: "customer" | "rider") =>
    api.get<Policy[]>("/api/policies", { params: { audience } }).then((r) => r.data),
  one: (slug: string) => api.get<Policy>(`/api/policies/${slug}`).then((r) => r.data),
  // Admin
  overview: () => api.get<AdminPolicy[]>("/api/admin/policies").then((r) => r.data),
  version: (id: string) => api.get<Policy>(`/api/admin/policies/versions/${id}`).then((r) => r.data),
  publish: (slug: string, body: { title: string; content: string; changeSummary?: string }) =>
    api.post<Policy>(`/api/admin/policies/${slug}`, body).then((r) => r.data),
  consents: (audience: "customer" | "rider") =>
    api.get<ConsentTable>("/api/admin/consents", { params: { audience } }).then((r) => r.data),
  proof: (audience: "customer" | "rider", subjectId: string) =>
    api.get<ConsentProof>(`/api/admin/consents/${audience}/${subjectId}`).then((r) => r.data),
};
