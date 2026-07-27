import React from "react";
import { View, Text, FlatList, StyleSheet, TextInput, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PillButton } from "@/components/PillButton";
import { PriceActionButton } from "@/components/PriceActionButton";
import { QtyStepper } from "@/components/QtyStepper";
import { colors, radii, money } from "@/theme/glass";
import { estimateDeliveryFee, withinDeliveryArea } from "@/lib/delivery";
import { foodEmoji } from "@/lib/menu";
import { RootStackParamList } from "@/navigation/types";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { useConfig } from "@/store/config";
import { usePrefs, Fulfillment } from "@/store/prefs";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";

type Props = NativeStackScreenProps<RootStackParamList, "Cart">;

export function CartScreen({ navigation }: Props) {
  const { lines, updateQty, remove, subtotal } = useCart();
  const { coords } = useDeviceLocation();
  const session = useAuth((s) => s.session);
  const config = useConfig((s) => s.config);
  const fulfillment = usePrefs((s) => s.fulfillment);
  const setFulfillment = usePrefs((s) => s.setFulfillment);
  const sub = subtotal();
  const isPickup = fulfillment === "pickup";
  // Free delivery once the subtotal clears the admin-set threshold (0 = off).
  const freeDelivery = !isPickup && config.freeDeliveryThreshold > 0 && sub >= config.freeDeliveryThreshold;
  const feeEstimate = isPickup || freeDelivery ? 0 : estimateDeliveryFee(coords);
  const total = sub + (feeEstimate ?? 0);

  // Checkout gating from admin settings: store closed, outside delivery area, or below the minimum order.
  const belowMin = config.minOrderAmount > 0 && sub < config.minOrderAmount;
  const outsideArea = !isPickup && !withinDeliveryArea(coords);
  const blockReason = !config.acceptingOrders
    ? config.closedMessage
    : outsideArea
    ? `Delivery is only available within ${config.maxDeliveryKm} km (Accra). Switch to Self-pickup to continue.`
    : belowMin
    ? `Minimum order is ${money(config.minOrderAmount)} — add ${money(config.minOrderAmount - sub)} more to check out.`
    : null;

  if (lines.length === 0) {
    return (
      <ScreenBackground>
        <ScreenHeader title="Cart" onBack={() => navigation.goBack()} />
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>Add some tasty dishes to get started.</Text>
          <PillButton title="Browse menu" onPress={() => navigation.navigate("Main")} style={{ marginTop: 20, alignSelf: "stretch" }} />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScreenHeader title="Cart" onBack={() => navigation.goBack()} />
      <FlatList
        data={lines}
        keyExtractor={(l) => l.item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 320 }}
        renderItem={({ item: line }) => (
          <View style={styles.card}>
            <View style={styles.thumb}>
              {line.item.photoUrl ? (
                <Image source={{ uri: line.item.photoUrl }} style={styles.thumbImg} />
              ) : (
                <Text style={styles.thumbEmoji}>{foodEmoji(line.item.name)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.cardTop}>
                <Text style={styles.name} numberOfLines={1}>{line.item.name}</Text>
                <Pressable onPress={() => remove(line.item.id)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              {line.addOns ? <Text style={styles.addOns} numberOfLines={1}>+ {line.addOns}</Text> : null}
              <View style={styles.cardBottom}>
                <Text style={styles.price}>{money(line.item.price * line.quantity)}</Text>
                <QtyStepper value={line.quantity} onChange={(n) => updateQty(line.item.id, n)} />
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.toggle}>
          {(["delivery", "pickup"] as Fulfillment[]).map((m) => {
            const active = fulfillment === m;
            return (
              <Pressable key={m} style={[styles.toggleBtn, active && styles.toggleActive]} onPress={() => setFulfillment(m)}>
                <Ionicons
                  name={m === "delivery" ? "bicycle-outline" : "storefront-outline"}
                  size={16}
                  color={active ? colors.textOnBrand : colors.textSecondary}
                />
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {m === "delivery" ? "Delivery" : "Self-pickup"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.voucher}>
          <View style={styles.voucherIcon}>
            <Ionicons name="pricetag-outline" size={16} color={colors.brand} />
          </View>
          <TextInput placeholder="Enter your voucher code" placeholderTextColor={colors.textMuted} style={styles.voucherInput} />
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>

        <Row label="Subtotal" value={money(sub)} />
        <Row
          label={isPickup ? "Delivery fee" : "Delivery fee (est.)"}
          value={isPickup || freeDelivery ? "Free" : feeEstimate != null ? money(feeEstimate) : "At checkout"}
          free={isPickup || freeDelivery}
        />
        <View style={styles.divider} />
        <Row label="Total" value={money(total)} bold />

        {blockReason && <Text style={styles.blockReason}>{blockReason}</Text>}

        <PriceActionButton
          price={money(total)}
          action={session ? "Checkout" : "Sign in"}
          onPress={() => navigation.navigate(session ? "DeliveryDetails" : "SignUp")}
          disabled={!!blockReason}
          style={{ marginTop: 14 }}
        />
      </View>
    </ScreenBackground>
  );
}

function Row({ label, value, bold, free }: { label: string; value: string; bold?: boolean; free?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.rowBold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowBold, free && styles.rowFree]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 6 },

  card: {
    flexDirection: "row", gap: 14, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 12, marginBottom: 12, alignItems: "center",
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  thumb: { width: 76, height: 76, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  thumbEmoji: { fontSize: 38 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  addOns: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  price: { fontSize: 17, fontWeight: "900", color: colors.brand },

  summary: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34,
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 8,
  },
  voucher: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  voucherIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  voucherInput: { flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 6 },
  toggle: { flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, padding: 4, gap: 6, marginBottom: 16 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 11, borderRadius: radii.pill },
  toggleActive: { backgroundColor: colors.brand },
  toggleText: { fontSize: 14, fontWeight: "800", color: colors.textSecondary },
  toggleTextActive: { color: colors.textOnBrand },
  row: { flexDirection: "row", justifyContent: "space-between", marginVertical: 5 },
  rowLabel: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  rowValue: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  rowBold: { fontWeight: "900", fontSize: 18, color: colors.textPrimary },
  rowFree: { color: colors.success, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 8 },
  blockReason: { color: "#B91C1C", fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 12 },
});
