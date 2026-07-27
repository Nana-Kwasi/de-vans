import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  email: string | null;
  fullName: string | null;
  setAuth: (token: string, email: string, fullName: string | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      fullName: null,
      setAuth: (token, email, fullName) => set({ token, email, fullName }),
      logout: () => set({ token: null, email: null, fullName: null }),
    }),
    { name: "quickchop-admin-auth" }
  )
);
