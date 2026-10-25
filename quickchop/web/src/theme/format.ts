import { Order } from "@/api/types";

export const money = (amount: number | string) => `GHS ${Number(amount).toFixed(2)}`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const BUSINESS_NAME = "Qooka Qooks Restaurant";

/** The mobile app tags fulfillment + contact phone into the kitchen note
 *  (e.g. "[DELIVERY] · ☎ +233… · extra pepper"). Pull those back out for display. */
export function parseOrderMeta(order: Order): {
  fulfillment: "delivery" | "pickup";
  phone?: string;
  note?: string;
} {
  const raw = order.kitchenNote ?? "";
  const pickup = /\[SELF-PICKUP\]/i.test(raw) || /self-?pickup/i.test(order.deliveryAddress ?? "");
  const phoneMatch = raw.match(/☎\s*([+\d][\d\s-]{5,})/);
  const phone = phoneMatch ? phoneMatch[1].trim() : undefined;
  const note = raw
    .replace(/\[(SELF-PICKUP|DELIVERY)\]/gi, "")
    .replace(/☎\s*[+\d][\d\s-]{5,}/g, "")
    .replace(/·/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { fulfillment: pickup ? "pickup" : "delivery", phone, note: note || undefined };
}
