import { create } from "zustand";

export interface Address {
  id: string;
  label: string; // e.g. "Home", "Work"
  address: string;
}

export type Fulfillment = "delivery" | "pickup";

interface PrefsState {
  addresses: Address[];
  selectedId: string | null;
  fulfillment: Fulfillment;
  addAddress: (label: string, address: string) => string;
  updateAddress: (id: string, label: string, address: string) => void;
  removeAddress: (id: string) => void;
  select: (id: string) => void;
  selected: () => Address | null;
  setFulfillment: (f: Fulfillment) => void;
}

/** Local (in-memory) address book. App-first stub — a backend customer-address
 *  endpoint would persist these across sessions/devices. */
export const usePrefs = create<PrefsState>((set, get) => ({
  addresses: [],
  selectedId: null,
  fulfillment: "delivery",
  setFulfillment: (f) => set({ fulfillment: f }),
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
}));
