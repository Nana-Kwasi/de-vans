import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { GlassCard } from "@/components/GlassCard";
import { PillButton } from "@/components/PillButton";
import { ReviewModal } from "@/components/ReviewModal";
import { colors, heading, subheading, money } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { OrderApi, ReviewApi } from "@/api/endpoints";
import { Order, OrderItem, OrderStatus } from "@/api/types";

type Props = NativeStackScreenProps<RootStackParamList, "OrderTracking">;

// Pickup and delivery track through different steps.
const DELIVERY_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "ORDER_RECEIVED", label: "Order Received" },
  { status: "PREPARING", label: "Preparing" },
  { status: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { status: "DELIVERED", label: "Delivered" },
];
const PICKUP_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "ORDER_RECEIVED", label: "Order Received" },
  { status: "PREPARING", label: "Processing" },
  { status: "READY", label: "Ready for Pickup" },
];

const BANNER: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "We've got your order! 🎉",
  PREPARING: "Your food is on the stove 🍳",
  OUT_FOR_DELIVERY: "On the way to you 🛵",
  DELIVERED: "Delivered — enjoy your meal! 😋",
  READY: "Ready for pickup — come grab it! 🛍️",
  CANCELLED: "This order was cancelled.",
};

function bannerText(order: Order): string {
  if (order.status === "PREPARING" && order.pickup) return "We're processing your order 👩‍🍳";
  return BANNER[order.status as OrderStatus];
}

export function OrderTrackingScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: () => OrderApi.get(orderId),
    refetchInterval: 5000,
  });

  const [reviewOpen, setReviewOpen] = useState(false);
  // null = still loading the persisted flag, false = not reviewed, true = reviewed.
  const [reviewed, setReviewed] = useState<boolean | null>(null);
  const reviewKey = `qooka.reviewed.${orderId}`;

  useEffect(() => {
    AsyncStorage.getItem(reviewKey).then((v) => setReviewed(v === "1"));
  }, [reviewKey]);

  // Prompt for an optional review once, when the order is delivered / ready for pickup.
  useEffect(() => {
    if ((order?.status === "DELIVERED" || order?.status === "READY") && reviewed === false) setReviewOpen(true);
  }, [order?.status, reviewed]);

  const markReviewed = () => {
    AsyncStorage.setItem(reviewKey, "1");
    setReviewed(true);
    setReviewOpen(false);
  };

  const submitReview = async (rating: number, comment: string) => {
    try {
      await ReviewApi.create({ orderId, rating, comment: comment || undefined });
      markReviewed();
      Alert.alert("Thank you!", "Your review was submitted.");
    } catch (e: any) {
      Alert.alert("Couldn't submit", e?.response?.data?.message ?? "Please try again.");
    }
  };

  const toHome = () => navigation.reset({ index: 0, routes: [{ name: "Main" }] });

  if (isLoading || !order) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Track Order" onBack={toHome} />
        <ActivityIndicator color={colors.brand} style={{ marginTop: 80 }} />
      </ScreenBackground>
    );
  }

  const steps = order.pickup ? PICKUP_STEPS : DELIVERY_STEPS;
  const finalStatus: OrderStatus = order.pickup ? "READY" : "DELIVERED";
  const currentIndex = steps.findIndex((s) => s.status === order.status);
  const cancelled = order.status === "CANCELLED";

  return (
    <ScreenBackground>
      <ScreenHeader title="Track Order" onBack={toHome} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        <GlassCard>
          <Text style={styles.orderNo}>{order.orderNumber}</Text>
          <Text style={heading}>{bannerText(order)}</Text>
          <Text style={subheading}>
            {order.deliveryTimeNote ? `Delivery: ${order.deliveryTimeNote}` : "Estimated arrival soon"}
          </Text>
        </GlassCard>

        <GlassCard style={{ marginTop: 16 }}>
          {steps.map((step, i) => {
            const done = !cancelled && i <= currentIndex;
            // The final state (Delivered / Ready) is complete (green), not in-progress (orange).
            const active = !cancelled && i === currentIndex && order.status !== finalStatus;
            return (
              <View key={step.status} style={styles.stepRow}>
                <View style={styles.stepColumn}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]} />
                  {i < steps.length - 1 && <View style={[styles.rail, done && styles.railDone]} />}
                </View>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
              </View>
            );
          })}
        </GlassCard>

        <GlassCard style={{ marginTop: 16 }}>
          <Text style={styles.section}>Order summary</Text>
          {order.items.map((it: OrderItem) => (
            <View key={it.id} style={styles.line}>
              <Text style={styles.lineName}>{it.quantity}× {it.name}</Text>
              <Text style={styles.lineVal}>{money(it.unitPrice * it.quantity)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.line}>
            <Text style={styles.total}>Total</Text>
            <Text style={styles.total}>{money(order.total)}</Text>
          </View>
        </GlassCard>

        <PillButton title="Back to menu" variant="ghost" onPress={toHome} style={{ marginTop: 20 }} />
      </ScrollView>

      <ReviewModal
        visible={reviewOpen}
        orderNumber={order.orderNumber}
        onClose={markReviewed}
        onSubmit={submitReview}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  orderNo: { fontWeight: "900", color: colors.brand, marginBottom: 6 },
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  stepColumn: { alignItems: "center", width: 34 },
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.hairline },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  rail: { width: 3, height: 34, backgroundColor: colors.hairline },
  railDone: { backgroundColor: colors.success },
  stepLabel: { fontSize: 16, fontWeight: "700", color: colors.textMuted, marginTop: -2, paddingBottom: 24 },
  stepLabelDone: { color: colors.textPrimary },
  section: { fontSize: 16, fontWeight: "900", color: colors.textPrimary, marginBottom: 10 },
  line: { flexDirection: "row", justifyContent: "space-between", marginVertical: 3 },
  lineName: { color: colors.textSecondary, fontWeight: "600" },
  lineVal: { color: colors.textPrimary, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 8 },
  total: { fontWeight: "900", fontSize: 17, color: colors.textPrimary },
});
