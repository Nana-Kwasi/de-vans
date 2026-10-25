import { create } from "zustand";
import { AppConfig } from "@/api/types";
import { ConfigApi } from "@/api/endpoints";

/** Sensible defaults used before the fetch completes or if the backend is
 *  unreachable — the app stays fully usable. Overridden by GET /api/config. */
export const DEFAULT_CONFIG: AppConfig = {
  businessName: "Qooka Qooks Restaurant",
  acceptingOrders: true,
  closedMessage: "We are currently closed. Please check back soon.",
  contactPhone: "",
  storeAddress: "Anyaa Last Stop, Accra",
  announcementEnabled: false,
  announcementText: "",
  promoEnabled: true,
  promoTitle: "Gonna Be a Good Day!",
  promoText: "Free delivery & 10% cashback on your first order.",
  promoCta: "Order Now",
  promoImageUrl: null,
  deliveryBaseFee: 10,
  deliveryPerKm: 4,
  deliveryMaxFee: 120,
  deliveryIncludedKm: 3,
  deliveryRoadFactor: 1.35,
  freeDeliveryThreshold: 0,
  minOrderAmount: 0,
  maxDeliveryKm: 25,
  storeLat: 5.6072,
  storeLng: -0.2838,
};

interface ConfigState {
  config: AppConfig;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useConfig = create<ConfigState>((set) => ({
  config: DEFAULT_CONFIG,
  loaded: false,
  load: async () => {
    try {
      const c = await ConfigApi.get();
      set({ config: { ...DEFAULT_CONFIG, ...c }, loaded: true });
    } catch {
      set({ loaded: true }); // keep defaults on failure
    }
  },
}));

/** Non-hook accessor for use in plain functions (e.g. delivery fee math). */
export const currentConfig = () => useConfig.getState().config;
