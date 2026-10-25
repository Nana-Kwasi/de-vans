import React from "react";
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenBackground } from "@/components/ScreenBackground";
import { PillButton } from "@/components/PillButton";
import { SignInPrompt } from "@/components/SignInPrompt";
import { colors, radii, money } from "@/theme/glass";
import { RootStackParamList, TabParamList } from "@/navigation/types";
import { OrderApi } from "@/api/endpoints";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { Order, OrderItem, OrderStatus } from "@/api/types";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Orders">,
  NativeStackScreenProps<RootStackParamList>
>;

const STATUS_LABEL: Record<string, string> = {
  ORDER_RECEIVED: "Received",
  PREPARING: "Preparing",
  AWAITING_RIDER: "Finding rider",
  RIDER_ASSIGNED: "Rider assigned",
  OUT_FOR_DELIVERY: "On the way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function statusColor(status: OrderStatus): string {
  if (status === "DELIVERED") return colors.success;
  if (status === "CANCELLED") return colors.danger;
  return colors.brand;
}

export function OrderHistoryScreen({ navigation }: Props) {
  const session = useAuth((s) => s.session);
  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({ queryKey: ["myOrders"], queryFn: OrderApi.mine, enabled: !!session });
  const add = useCart((s) => s.add);
  const clear = useCart((s) => s.clear);

  const reorder = (order: Order) => {
    clear();
    order.items.forEach((it) =>
      add({ id: it.menuItemId, name: it.name, price: it.unitPrice, available: true }, it.quantity, it.addOns ?? undefined)
    );
    navigation.navigate("Cart");
  };

  if (!session) {
    return (
      <ScreenBackground>
        <Text style={styles.screenTitle}>Orders</Text>
        <SignInPrompt
          emoji="🧾"
          message="Sign in to see your orders and track deliveries."
          onSignIn={() => navigation.navigate("SignUp")}
        />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <Text style={styles.screenTitle}>Orders</Text>
      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🧾</Text>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>Your orders will show up here.</Text>
            </View>
          }
          renderItem={({ item: order }) => (
            <Pressable style={styles.card} onPress={() => navigation.navigate("OrderTracking", { orderId: order.id })}>
              <View style={styles.top}>
                <Text style={styles.no}>{order.orderNumber}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(order.status) + "1A" }]}>
                  <Text style={[styles.badgeText, { color: statusColor(order.status) }]}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.items} numberOfLines={1}>
                {order.items.map((i: OrderItem) => `${i.quantity}× ${i.name}`).join(", ")}
              </Text>
              <View style={styles.divider} />
              <View style={styles.bottom}>
                <Text style={styles.total}>{money(order.total)}</Text>
                <PillButton title="Reorder" variant="ghost" onPress={() => reorder(order)} style={styles.reorderBtn} />
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 26, fontWeight: "900", color: colors.textPrimary, marginTop: 12, marginBottom: 12 },
  empty: { alignItems: "center", justifyContent: "center", marginTop: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, marginBottom: 14,
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  no: { fontWeight: "900", color: colors.textPrimary, fontSize: 16 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radii.pill },
  badgeText: { fontWeight: "800", fontSize: 12 },
  items: { color: colors.textMuted, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 12 },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  total: { fontWeight: "900", fontSize: 18, color: colors.textPrimary },
  reorderBtn: { height: 40, paddingHorizontal: 20 },
});
