import { api } from "./client";
import { AppSettings, Customer, DashboardSummary, MenuItem, Order, OrderStatus, Review, SupportStatus, SupportTicket } from "./types";

export const AuthApi = {
  login: (email: string, password: string) =>
    api
      .post<{ token: string; email: string; fullName: string }>("/api/admin/login", {
        email,
        password,
      })
      .then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch("/api/admin/change-password", { currentPassword, newPassword }).then((r) => r.data),
};

export const OrdersApi = {
  list: (status?: OrderStatus) =>
    api
      .get<Order[]>("/api/orders", { params: status ? { status } : {} })
      .then((r) => r.data),
  updateStatus: (id: string, status: OrderStatus) =>
    api.patch<Order>(`/api/orders/${id}/status`, { status }).then((r) => r.data),
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
};

export const SettingsApi = {
  get: () => api.get<AppSettings>("/api/config").then((r) => r.data),
  update: (body: Partial<AppSettings>) =>
    api.patch<AppSettings>("/api/admin/settings", body).then((r) => r.data),
};
