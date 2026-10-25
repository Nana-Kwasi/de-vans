import React, { useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { colors, radii } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { useNotificationFeed } from "@/hooks/useNotificationFeed";
import { useNotifications } from "@/store/notifications";
import { Order, OrderStatus } from "@/api/types";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;
type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_NOTE: Record<OrderStatus, { icon: IconName; title: string; body: string }> = {
  ORDER_RECEIVED: { icon: "receipt-outline", title: "Order received", body: "We've got your order and will start soon." },
  PREPARING: { icon: "restaurant-outline", title: "Preparing your food", body: "The kitchen is cooking your order." },
  AWAITING_RIDER: { icon: "time-outline", title: "Food ready", body: "We're assigning a rider to bring it to you." },
  RIDER_ASSIGNED: { icon: "person-outline", title: "Rider assigned", body: "Your rider is heading to the kitchen. Tap to see who." },
  OUT_FOR_DELIVERY: { icon: "bicycle-outline", title: "Out for delivery", body: "Your order is on the way to you." },
  DELIVERED: { icon: "checkmark-circle-outline", title: "Delivered", body: "Enjoy your meal! Tap to leave a review." },
  READY: { icon: "bag-check-outline", title: "Ready for pickup", body: "Your order is ready — come grab it!" },
  CANCELLED: { icon: "close-circle-outline", title: "Order cancelled", body: "This order was cancelled." },
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (isNaN(d)) return "";
  const mins = Math.floor((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsScreen({ navigation }: Props) {
  const { items: feed, isLoading, refetch, isRefetching } = useNotificationFeed();
  const markAllSeen = useNotifications((s) => s.markAllSeen);

  // Opening the screen is what "reading" means here. Marked on unmount so the unread
  // highlights stay visible while you are actually looking at them.
  useEffect(() => () => markAllSeen(), [markAllSeen]);

  const items = feed.map((f) => ({
    ...STATUS_NOTE[f.status],
    id: f.key,
    orderId: f.orderId,
    when: f.at,
    orderNumber: f.orderNumber,
    unread: f.unread,
  }));

  return (
    <ScreenBackground>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptyText}>Order updates will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, item.unread && styles.rowUnread]}
              onPress={() => navigation.navigate("OrderTracking", { orderId: item.orderId })}
            >
              <View style={[styles.icon, item.unread && styles.iconUnread]}>
                <Ionicons name={item.icon} size={20} color={item.unread ? colors.textOnBrand : colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={[styles.title, item.unread && styles.titleUnread]}>{item.title}</Text>
                  <Text style={styles.time}>{timeAgo(item.when)}</Text>
                </View>
                <Text style={styles.body}>Order {item.orderNumber} · {item.body}</Text>
              </View>
              {item.unread ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  rowUnread: { backgroundColor: "#FFF5EC" },
  iconUnread: { backgroundColor: colors.brand },
  titleUnread: { fontWeight: "900" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand, alignSelf: "center", marginLeft: 8 },
  empty: { alignItems: "center", marginTop: 80 },
  emptyEmoji: { fontSize: 50, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  row: { flexDirection: "row", gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 14, marginBottom: 12 },
  icon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  time: { fontSize: 12, color: colors.textMuted },
  body: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
});
