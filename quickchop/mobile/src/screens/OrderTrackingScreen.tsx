import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Alert, Linking, Pressable } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
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
import { GeoPoint, Order, OrderItem, OrderStatus, OrderTracking } from "@/api/types";
import { PinPickerModal } from "@/components/PinPickerModal";

type Props = NativeStackScreenProps<RootStackParamList, "OrderTracking">;

// Pickup and delivery track through different steps.
const DELIVERY_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "ORDER_RECEIVED", label: "Order Received" },
  { status: "PREPARING", label: "Preparing" },
  { status: "AWAITING_RIDER", label: "Finding a Rider" },
  { status: "RIDER_ASSIGNED", label: "Rider Assigned" },
  { status: "OUT_FOR_DELIVERY", label: "On the Way" },
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
  AWAITING_RIDER: "Food's ready — finding you a rider 🔎",
  RIDER_ASSIGNED: "Your rider is heading to the kitchen 🛵",
  OUT_FOR_DELIVERY: "On the way to you 🛵",
  DELIVERED: "Delivered — enjoy your meal! 😋",
  READY: "Ready for pickup — come grab it! 🛍️",
  CANCELLED: "This order was cancelled.",
};

const VEHICLE: Record<string, string> = { MOTORBIKE: "Motorbike", BICYCLE: "Bicycle", CAR: "Car", ON_FOOT: "On foot" };

function secondsAgo(iso?: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

function bannerText(order: Order): string {
  if (order.status === "PREPARING" && order.pickup) return "We're processing your order 👩‍🍳";
  if (order.status === "OUT_FOR_DELIVERY" && order.delivery?.status === "ARRIVED") return "Your rider has arrived! 📍";
  return BANNER[order.status as OrderStatus];
}

export function OrderTrackingScreen({ route, navigation }: Props) {
  const { orderId } = route.params;
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", orderId],
    queryFn: () => OrderApi.get(orderId),
    refetchInterval: 5000,
  });

  // Live rider tracking (delivery orders only). Polls while the order is in flight.
  const inFlight = !!order && !order.pickup && order.status !== "DELIVERED" && order.status !== "CANCELLED";
  const { data: tracking, refetch: refetchTracking } = useQuery<OrderTracking>({
    queryKey: ["tracking", orderId],
    queryFn: () => OrderApi.tracking(orderId),
    enabled: !!order && !order.pickup,
    refetchInterval: inFlight ? 5000 : false,
  });
  const [pinOpen, setPinOpen] = useState(false);
  const moveDropoff = async (c: { latitude: number; longitude: number }) => {
    setPinOpen(false);
    try {
      await OrderApi.updateDropoff(orderId, { lat: c.latitude, lng: c.longitude });
      refetchTracking();
      Alert.alert("Location updated", "Your rider will be guided to the new spot.");
    } catch (e: any) {
      Alert.alert("Couldn't update", e?.response?.data?.message ?? "Please try again.");
    }
  };

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

        {/* paidAt is explicitly null on servers that track payment; absent on older ones. */}
        {order.paidAt === null && order.status !== "CANCELLED" && (
          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.section}>Awaiting payment</Text>
            <Text style={styles.riderMeta}>Your order is saved but not paid yet. The kitchen starts once payment is confirmed.</Text>
            <PillButton title={`Pay ${money(order.total)}`} onPress={() => navigation.navigate("Payment", { order })} style={{ marginTop: 12 }} />
          </GlassCard>
        )}

        {!order.pickup && tracking && (
          <RiderSection tracking={tracking} order={order} onMovePin={() => setPinOpen(true)} />
        )}

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

      <PinPickerModal
        visible={pinOpen}
        initial={
          tracking?.dropoff
            ? { latitude: tracking.dropoff.lat, longitude: tracking.dropoff.lng }
            : order.deliveryLat != null && order.deliveryLng != null
            ? { latitude: order.deliveryLat, longitude: order.deliveryLng }
            : null
        }
        onCancel={() => setPinOpen(false)}
        onConfirm={moveDropoff}
      />

      <ReviewModal
        visible={reviewOpen}
        orderNumber={order.orderNumber}
        onClose={markReviewed}
        onSubmit={submitReview}
      />
    </ScreenBackground>
  );
}

/** Everything about the rider: who they are, how to reach them, where they are, and the hand-over code. */
function RiderSection({ tracking, order, onMovePin }: { tracking: OrderTracking; order: Order; onMovePin: () => void }) {
  const d = tracking.delivery;
  const done = order.status === "DELIVERED" || order.status === "CANCELLED";
  const rider = d?.riderName ? d : null;
  const toPoint = (p: GeoPoint) => ({ latitude: p.lat, longitude: p.lng });

  const points = [
    tracking.riderLocation && toPoint(tracking.riderLocation),
    tracking.dropoff && toPoint(tracking.dropoff),
    d && (d.status === "ASSIGNED" || d.status === "OPEN") && toPoint(tracking.store),
  ].filter(Boolean) as { latitude: number; longitude: number }[];
  const mapRef = React.useRef<MapView>(null);
  const sig = points.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join("|");
  useEffect(() => {
    if (points.length > 1) {
      mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
    }
  }, [sig]);

  return (
    <>
      {rider && (
        <GlassCard style={{ marginTop: 16 }}>
          <Text style={styles.section}>{done ? "Delivered by" : "Your rider"}</Text>
          <View style={styles.riderRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{rider.riderName!.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.riderName}>{rider.riderName}</Text>
              <Text style={styles.riderMeta}>
                {VEHICLE[rider.vehicleType ?? ""] ?? "Rider"}
                {rider.vehiclePlate ? ` · ${rider.vehiclePlate}` : ""}
              </Text>
              {rider.riderPhone && <Text style={styles.riderMeta}>{rider.riderPhone}</Text>}
            </View>
          </View>
          {!done && rider.riderPhone && (
            <View style={styles.contactRow}>
              <Pressable style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${rider.riderPhone}`)}>
                <Ionicons name="call" size={18} color={colors.textOnBrand} />
                <Text style={styles.contactText}>Call rider</Text>
              </Pressable>
              <Pressable style={[styles.contactBtn, styles.contactGhost]} onPress={() => Linking.openURL(`sms:${rider.riderPhone}`)}>
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.brand} />
                <Text style={[styles.contactText, { color: colors.brand }]}>Message</Text>
              </Pressable>
            </View>
          )}
          {!done && (
            <Text style={styles.etaText}>
              {d!.status === "ARRIVED"
                ? "📍 Your rider is at your location"
                : tracking.etaMinutes != null
                ? `⏱ About ${tracking.etaMinutes} min away${tracking.riderDistanceKm != null ? ` · ${tracking.riderDistanceKm} km` : ""}`
                : "Waiting for your rider's location…"}
              {tracking.riderLocation?.at ? `  ·  updated ${secondsAgo(tracking.riderLocation.at)}` : ""}
            </Text>
          )}
        </GlassCard>
      )}

      {!done && d?.status === "OPEN" && (
        <GlassCard style={{ marginTop: 16 }}>
          <Text style={styles.section}>Finding your rider…</Text>
          <Text style={styles.riderMeta}>Your food is packed. We'll show your rider's name, phone and live location here as soon as one accepts.</Text>
        </GlassCard>
      )}

      {!done && tracking.deliveryPin && (
        <GlassCard style={{ marginTop: 16 }}>
          <Text style={styles.section}>Delivery code</Text>
          <Text style={styles.pin}>{tracking.deliveryPin.split("").join(" ")}</Text>
          <Text style={styles.riderMeta}>Give this code to your rider only after you have your food. Never share it before.</Text>
        </GlassCard>
      )}

      {!done && points.length > 0 && (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{ ...points[0], latitudeDelta: 0.03, longitudeDelta: 0.03 }}
          >
            {tracking.riderLocation && (
              <Marker coordinate={toPoint(tracking.riderLocation)} title={rider?.riderName ?? "Rider"} pinColor="#2563EB" />
            )}
            {tracking.dropoff && <Marker coordinate={toPoint(tracking.dropoff)} title="You" pinColor={colors.success} />}
            {d && (d.status === "ASSIGNED" || d.status === "OPEN") && (
              <Marker coordinate={toPoint(tracking.store)} title="Kitchen" pinColor={colors.brand} />
            )}
          </MapView>
        </View>
      )}

      {!done && (
        <Pressable onPress={onMovePin} style={styles.movePin}>
          <Ionicons name="navigate-outline" size={16} color={colors.brand} />
          <Text style={styles.movePinText}>Moved? Update my delivery location</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  riderRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "900", color: colors.brand },
  riderName: { fontSize: 18, fontWeight: "900", color: colors.textPrimary },
  riderMeta: { color: colors.textSecondary, fontWeight: "600", marginTop: 2, lineHeight: 19 },
  contactRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  contactBtn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 46, borderRadius: 999, backgroundColor: colors.brand },
  contactGhost: { backgroundColor: colors.brandSoft },
  contactText: { color: colors.textOnBrand, fontWeight: "800" },
  etaText: { marginTop: 12, color: colors.textPrimary, fontWeight: "700" },
  pin: { fontSize: 36, fontWeight: "900", letterSpacing: 6, color: colors.brand, textAlign: "center", marginVertical: 6 },
  mapWrap: { height: 240, borderRadius: 22, overflow: "hidden", marginTop: 16 },
  movePin: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingVertical: 8 },
  movePinText: { color: colors.brand, fontWeight: "800" },
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
