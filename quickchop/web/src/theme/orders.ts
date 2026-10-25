import { Order, OrderStatus } from "@/api/types";

// Pickup and delivery advance through different flows. Delivery orders stop at Preparing
// on the board: "Send to riders" hands them to the rider app, which drives later steps.
const NEXT_DELIVERY: Partial<Record<OrderStatus, OrderStatus>> = {
  ORDER_RECEIVED: "PREPARING",
};
const NEXT_PICKUP: Partial<Record<OrderStatus, OrderStatus>> = {
  ORDER_RECEIVED: "PREPARING",
  PREPARING: "READY",
};

export const nextStatus = (order: Pick<Order, "pickup" | "status">): OrderStatus | undefined =>
  (order.pickup ? NEXT_PICKUP : NEXT_DELIVERY)[order.status];

// PREPARING reads as "Processing" for pickup, "Preparing" for delivery.
export const statusLabel = (status: OrderStatus, pickup: boolean): string => {
  if (status === "PREPARING" && pickup) return "Processing";
  if (status === "AWAITING_RIDER") return "Waiting for rider";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "bg-amber-100 text-amber-700",
  PREPARING: "bg-blue-100 text-blue-700",
  AWAITING_RIDER: "bg-amber-100 text-amber-800",
  RIDER_ASSIGNED: "bg-sky-100 text-sky-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  READY: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export const isTerminal = (status: OrderStatus) =>
  status === "DELIVERED" || status === "READY" || status === "CANCELLED";

/** "5 min ago" / "2 h ago" / date — orders are judged by how long they've waited. */
export function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
