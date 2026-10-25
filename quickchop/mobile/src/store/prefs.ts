import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Address {
  id: string;
  label: string; // e.g. "Home", "Work"
  address: string;
}

export type Fulfillment = "delivery" | "pickup";

export interface Coords {
  latitude: number;
  longitude: number;
}

interface PrefsState {
  addresses: Address[];
  selectedId: string | null;
  fulfillment: Fulfillment;
  /** Last location detected on the home screen, reused to prefill checkout. */
  detectedLabel: string | null;
  detectedCoords: Coords | null;
  addAddress: (label: string, address: string) => string;
  updateAddress: (id: string, label: string, address: string) => void;
  removeAddress: (id: string) => void;
  select: (id: string) => void;
  selected: () => Address | null;
  setFulfillment: (f: Fulfillment) => void;
  setDetected: (label: string | null, coords: Coords | null) => void;
}

/**
 * Saved addresses and delivery preferences.
 *
 * Persisted to device storage: this used to be in-memory, so every address a customer
 * saved was gone the next time they opened the app, and the checkout screen had nothing
 * to prefill from.
 */
export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      addresses: [],
      selectedId: null,
      fulfillment: "delivery",
      detectedLabel: null,
      detectedCoords: null,
      setFulfillment: (f) => set({ fulfillment: f }),
      setDetected: (detectedLabel, detectedCoords) => set({ detectedLabel, detectedCoords }),
      addAddress: (label, address) => {
        const id = Math.random().toString(36).slice(2);
        set((s) => ({
          addresses: [...s.addresses, { id, label, address }],
          selectedId: s.selectedId ?? id,
        }));
        return id;
      },
      updateAddress: (id, label, address) =>
        set((s) => ({ addresses: s.addresses.map((a) => (a.id === id ? { ...a, label, address } : a)) })),
      removeAddress: (id) =>
        set((s) => {
          const addresses = s.addresses.filter((a) => a.id !== id);
          return { addresses, selectedId: s.selectedId === id ? (addresses[0]?.id ?? null) : s.selectedId };
        }),
      select: (id) => set({ selectedId: id }),
      selected: () => get().addresses.find((a) => a.id === get().selectedId) ?? null,
    }),
    {
      name: "qooka.prefs",
      storage: createJSONStorage(() => AsyncStorage),
      // Only data is stored; the actions and the derived `selected` getter are
      // rebuilt on load and would otherwise be serialised as null.
      partialize: (s) => ({
        addresses: s.addresses,
        selectedId: s.selectedId,
        fulfillment: s.fulfillment,
        detectedLabel: s.detectedLabel,
        detectedCoords: s.detectedCoords,
      }),
    }
  )
);
