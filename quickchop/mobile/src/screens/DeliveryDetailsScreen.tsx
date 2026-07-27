import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PillButton } from "@/components/PillButton";
import { colors, radii, money } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { useConfig } from "@/store/config";
import { usePrefs } from "@/store/prefs";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { etaLabel, estimateDeliveryFee } from "@/lib/delivery";
import { OrderApi, CustomerApi } from "@/api/endpoints";
import { Customer } from "@/api/types";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryDetails">;
type Mode = "delivery" | "pickup";

export function DeliveryDetailsScreen({ navigation }: Props) {
  const { lines } = useCart();
  const { coords } = useDeviceLocation();
  const config = useConfig((s) => s.config);
  const STORE = `${config.businessName} · ${config.storeAddress}`;
  const customer = useAuth((s) => s.customer);
  const setCustomer = useAuth((s) => s.setCustomer);
  const savedAddress = usePrefs((s) => s.selected());
  const mode = usePrefs((s) => s.fulfillment);
  const setMode = usePrefs((s) => s.setFulfillment);
  const [address, setAddress] = useState(savedAddress?.address ?? "");
  const [phone, setPhone] = useState(customer?.phoneNumber ?? "");
  const [timeNote, setTimeNote] = useState("ASAP");
  const [kitchenNote, setKitchenNote] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill contact phone + address from the saved profile in the DB.
  const { data: me } = useQuery<Customer>({ queryKey: ["me"], queryFn: CustomerApi.me, retry: false });
  const prefilled = useRef(false);
  useEffect(() => {
    if (me && !prefilled.current) {
      prefilled.current = true;
      if (me.phoneNumber) setPhone(me.phoneNumber);
      if (me.defaultAddress) setAddress((a) => a || me.defaultAddress || "");
      setCustomer(me);
    }
  }, [me, setCustomer]);

  const placeOrder = async () => {
    if (mode === "delivery" && !address.trim()) {
      return Alert.alert("Address needed", "Where should we deliver?");
    }
    if (!phone.trim()) {
      return Alert.alert("Phone needed", "Add a contact phone number for this order.");
    }
    setLoading(true);
    try {
      // Fulfillment type + contact phone are tagged into the note + address so
      // they show in the admin dashboard (until the backend gains dedicated
      // fulfillment / phone fields on the order).
      const tag = mode === "pickup" ? "[SELF-PICKUP]" : "[DELIVERY]";
      const order = await OrderApi.place({
        items: lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity, addOns: l.addOns })),
        deliveryAddress: mode === "pickup" ? `Self-pickup · ${STORE}` : address.trim(),
        deliveryTimeNote: timeNote.trim(),
        kitchenNote: [tag, `☎ ${phone.trim()}`, kitchenNote.trim()].filter(Boolean).join(" · "),
        deliveryLat: mode === "delivery" ? coords?.latitude : undefined,
        deliveryLng: mode === "delivery" ? coords?.longitude : undefined,
        pickup: mode === "pickup",
      });
      navigation.navigate("Payment", { order });
    } catch (e: any) {
      Alert.alert("Could not place order", e?.response?.data?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const feeEstimate = mode === "pickup" ? 0 : estimateDeliveryFee(coords);

  return (
    <ScreenBackground>
      <ScreenHeader title="Checkout" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        <Text style={styles.title}>How would you like it?</Text>

        {/* Delivery / Pickup toggle */}
        <View style={styles.toggle}>
          {(["delivery", "pickup"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable key={m} style={[styles.toggleBtn, active && styles.toggleActive]} onPress={() => setMode(m)}>
                <Ionicons
                  name={m === "delivery" ? "bicycle-outline" : "storefront-outline"}
                  size={18}
                  color={active ? colors.textOnBrand : colors.textSecondary}
                />
                <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                  {m === "delivery" ? "Delivery" : "Self-pickup"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.estimate}>
          <Ionicons name="time-outline" size={16} color={colors.brand} />
          <Text style={styles.estimateText}>
            {mode === "pickup" ? "Ready for pickup in ~15 min" : `Est. arrival ${etaLabel(coords)}`}
          </Text>
          <View style={styles.feeTag}>
            <Text style={styles.feeText}>
              {mode === "pickup"
                ? "No delivery fee"
                : feeEstimate != null
                ? `Delivery ${money(feeEstimate)}`
                : "Fee set at order"}
            </Text>
          </View>
        </View>

        {mode === "delivery" ? (
          <>
            <Text style={styles.label}>Delivery address</Text>
            <TextInput
              placeholder="House number, street, area"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { height: 88 }]}
              multiline
              value={address}
              onChangeText={setAddress}
            />
          </>
        ) : (
          <View style={styles.storeCard}>
            <View style={styles.storeIcon}>
              <Ionicons name="storefront" size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeName}>Pick up at store</Text>
              <Text style={styles.storeAddr}>{STORE}</Text>
            </View>
          </View>
        )}

        <Text style={styles.label}>Contact phone</Text>
        <TextInput
          placeholder="+233 …"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
        />

        <Text style={styles.label}>{mode === "pickup" ? "Pickup time" : "Delivery time"}</Text>
        <TextInput
          placeholder='"ASAP" or e.g. "6:30 PM"'
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={timeNote}
          onChangeText={setTimeNote}
        />

        <Text style={styles.label}>Note to the kitchen (optional)</Text>
        <TextInput
          placeholder="Allergies, spice level, gate code…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { height: 80 }]}
          multiline
          value={kitchenNote}
          onChangeText={setKitchenNote}
        />

        <PillButton title="Continue to payment" onPress={placeOrder} loading={loading} style={{ marginTop: 26 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "900", color: colors.textPrimary, marginTop: 6, marginBottom: 16 },
  toggle: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.pill, padding: 5, gap: 6 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: radii.pill },
  toggleActive: { backgroundColor: colors.brand },
  toggleText: { fontSize: 15, fontWeight: "800", color: colors.textSecondary },
  toggleTextActive: { color: colors.textOnBrand },
  estimate: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  estimateText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  feeTag: { backgroundColor: colors.brandSoft, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 5 },
  feeText: { color: colors.brand, fontWeight: "800", fontSize: 12 },
  storeCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, marginTop: 20 },
  storeIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  storeName: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  storeAddr: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  label: { marginTop: 22, marginBottom: 8, fontWeight: "800", color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textPrimary, textAlignVertical: "top",
  },
});
