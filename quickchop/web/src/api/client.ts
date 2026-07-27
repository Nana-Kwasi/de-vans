import axios from "axios";
import { config } from "./config";
import { useAuth } from "@/store/auth";

export const api = axios.create({ baseURL: config.apiBaseUrl, timeout: 15000 });

api.interceptors.request.use((req) => {
  const token = useAuth.getState().token;
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuth.getState().logout();
    }
    return Promise.reject(err);
  }
);
