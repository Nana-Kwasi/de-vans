import axios from "axios";
import { config } from "@/api/config";
import { DeliveryJob, PolicyStatus, RiderProfile, RiderSummary } from "@/api/types";
import { useRiderAuth } from "./store";

/** Separate client from the admin one: its own token, and a 401 signs out the rider only. */
export const riderHttp = axios.create({ baseURL: config.apiBaseUrl, timeout: 15000 });

riderHttp.interceptors.request.use((req) => {
  const token = useRiderAuth.getState().token;
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

riderHttp.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useRiderAuth.getState().logout();
    // A new policy version was published while the rider was signed in: the layout
    // refetches policy status and shows the acceptance screen.
    if (err.response?.data?.code === "POLICIES_NOT_ACCEPTED") policyListeners.forEach((fn) => fn());
    return Promise.reject(err);
  }
);

const policyListeners = new Set<() => void>();
export const onPoliciesRequired = (fn: () => void) => {
  policyListeners.add(fn);
  return () => void policyListeners.delete(fn);
};

/** Best human-readable message from an API error. */
export const errorMessage = (err: any, fallback = "Something went wrong. Please try again.") =>
  err?.response?.data?.message ?? (err?.response ? fallback : "No connection. Check your internet and try again.");

type Session = { token: string; rider: RiderProfile };

export const RiderApi = {
  login: (phoneNumber: string, password: string) =>
    riderHttp.post<Session>("/api/rider/login", { phoneNumber, password }).then((r) => r.data),
  me: () => riderHttp.get<RiderProfile>("/api/rider/me").then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    riderHttp.patch<Session>("/api/rider/change-password", { currentPassword, newPassword }).then((r) => r.data),
  logout: () => riderHttp.post("/api/rider/logout"),
  setOnline: (online: boolean) => riderHttp.post<RiderProfile>("/api/rider/status", { online }).then((r) => r.data),
  location: (lat: number, lng: number, accuracyM?: number) =>
    riderHttp.post("/api/rider/location", { lat, lng, accuracyM }),
  summary: () => riderHttp.get<RiderSummary>("/api/rider/summary").then((r) => r.data),
  policies: () => riderHttp.get<PolicyStatus[]>("/api/rider/policies").then((r) => r.data),
  acceptPolicies: (policyIds: string[]) =>
    riderHttp.post<PolicyStatus[]>("/api/rider/policies/accept", { policyIds }).then((r) => r.data),
  available: () => riderHttp.get<DeliveryJob[]>("/api/rider/deliveries/available").then((r) => r.data),
  active: () => riderHttp.get<DeliveryJob[]>("/api/rider/deliveries/active").then((r) => r.data),
  history: () => riderHttp.get<DeliveryJob[]>("/api/rider/deliveries/history").then((r) => r.data),
  get: (id: string) => riderHttp.get<DeliveryJob>(`/api/rider/deliveries/${id}`).then((r) => r.data),
  accept: (id: string) => riderHttp.post<DeliveryJob>(`/api/rider/deliveries/${id}/accept`).then((r) => r.data),
  release: (id: string) => riderHttp.post<DeliveryJob>(`/api/rider/deliveries/${id}/release`).then((r) => r.data),
  pickedUp: (id: string) => riderHttp.post<DeliveryJob>(`/api/rider/deliveries/${id}/picked-up`).then((r) => r.data),
  arrived: (id: string) => riderHttp.post<DeliveryJob>(`/api/rider/deliveries/${id}/arrived`).then((r) => r.data),
  complete: (id: string, pin: string) =>
    riderHttp.post<DeliveryJob>(`/api/rider/deliveries/${id}/complete`, { pin }).then((r) => r.data),
};
