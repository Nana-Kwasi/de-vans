import axios from "axios";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/** Axios instance pointed at the Spring Boot API. Attaches the Supabase JWT. */
export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use(async (req) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

// When the server says the current policies haven't been accepted (e.g. a new version was
// published), tell the policy gate to refetch and show itself.
const policyListeners = new Set<() => void>();
export const onPoliciesRequired = (fn: () => void) => {
  policyListeners.add(fn);
  return () => void policyListeners.delete(fn);
};

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.data?.code === "POLICIES_NOT_ACCEPTED") policyListeners.forEach((fn) => fn());
    return Promise.reject(err);
  }
);
