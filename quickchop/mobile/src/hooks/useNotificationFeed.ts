import { useQuery } from "@tanstack/react-query";
import { OrderApi } from "@/api/endpoints";
import { Order, OrderStatus } from "@/api/types";
import { useNotifications } from "@/store/notifications";

export interface FeedItem {
  key: string;
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  at: string;
  unread: boolean;
}

/**
 * The notification feed, built from every status change across the customer's orders.
 *
 * Previously the screen showed one row per order using only its current status, so a
 * completed order collapsed into a single line and the journey through it was lost.
 * Using the history gives a real timeline — and something to count as unread.
 */
export function useNotificationFeed() {
  const lastSeenAt = useNotifications((s) => s.lastSeenAt);
  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({
    queryKey: ["myOrders"],
    queryFn: OrderApi.mine,
  });

  const seenMs = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;

  const items: FeedItem[] = (orders ?? [])
    .flatMap((o) =>
      (o.history?.length ? o.history : [{ status: o.status, changedAt: o.createdAt }]).map((h) => ({
        key: `${o.id}:${h.status}:${h.changedAt}`,
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: h.status,
        at: h.changedAt,
        unread: new Date(h.changedAt).getTime() > seenMs,
      }))
    )
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return {
    items,
    unreadCount: items.filter((i) => i.unread).length,
    isLoading,
    refetch,
    isRefetching,
  };
}
