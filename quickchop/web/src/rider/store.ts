import { create } from "zustand";
import { persist } from "zustand/middleware";
import { RiderProfile } from "@/api/types";

/**
 * Rider session — kept apart from the admin session (different storage key, different
 * token issuer), so the same browser can never mix the two roles up.
 */
interface RiderAuthState {
  token: string | null;
  rider: RiderProfile | null;
  setSession: (token: string, rider: RiderProfile) => void;
  setRider: (rider: RiderProfile) => void;
  logout: () => void;
}

export const useRiderAuth = create<RiderAuthState>()(
  persist(
    (set) => ({
      token: null,
      rider: null,
      setSession: (token, rider) => set({ token, rider }),
      setRider: (rider) => set({ rider }),
      logout: () => set({ token: null, rider: null }),
    }),
    { name: "quickchop-rider-auth" }
  )
);
