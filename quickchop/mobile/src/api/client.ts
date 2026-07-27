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
