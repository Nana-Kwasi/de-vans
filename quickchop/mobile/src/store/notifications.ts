import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface NotificationsState {
  /** ISO timestamp of the last time the notifications screen was opened. */
  lastSeenAt: string | null;
  markAllSeen: () => void;
}

/**
 * Tracks how far the customer has read.
 *
 * A timestamp rather than a set of ids: notifications are derived from order status
 * history, so "everything before this moment" is both simpler and self-correcting as
 * new statuses arrive. Persisted, so the badge does not reappear on every app start.
 */
export const useNotifications = create<NotificationsState>()(
  persist(
    (set) => ({
      lastSeenAt: null,
      markAllSeen: () => set({ lastSeenAt: new Date().toISOString() }),
    }),
    {
      name: "qooka.notifications",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lastSeenAt: s.lastSeenAt }),
    }
  )
);
