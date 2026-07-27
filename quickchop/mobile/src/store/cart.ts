import { create } from "zustand";
import { MenuItem } from "@/api/types";

export interface CartLine {
  item: MenuItem;
  quantity: number;
  addOns?: string;
}

interface CartState {
  lines: CartLine[];
  add: (item: MenuItem, quantity: number, addOns?: string) => void;
  updateQty: (menuItemId: string, quantity: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  lines: [],
  add: (item, quantity, addOns) =>
    set((state) => {
      const existing = state.lines.find((l) => l.item.id === item.id);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.item.id === item.id
              ? { ...l, quantity: l.quantity + quantity, addOns: addOns ?? l.addOns }
              : l
          ),
        };
      }
      return { lines: [...state.lines, { item, quantity, addOns }] };
    }),
  updateQty: (menuItemId, quantity) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.item.id === menuItemId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    })),
  remove: (menuItemId) =>
    set((state) => ({ lines: state.lines.filter((l) => l.item.id !== menuItemId) })),
  clear: () => set({ lines: [] }),
  subtotal: () =>
    get().lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0),
  count: () => get().lines.reduce((sum, l) => sum + l.quantity, 0),
}));
