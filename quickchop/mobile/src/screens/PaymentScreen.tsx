import React, { useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PriceActionButton } from "@/components/PriceActionButton";
import { MockPaymentSheet } from "@/components/MockPaymentSheet";
import { colors, radii, money } from "@/theme/glass";
import { SIMULATE_PAYMENTS } from "@/lib/config";
import { RootStackParamList } from "@/navigation/types";
import { PaymentApi } from "@/api/endpoints";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Payment">;

export function PaymentScreen({ route, navigation }: Props) {
  const { order } = route.params;
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(false);
  const clearCart = useCart((s) => s.clear);
  const customer = useAuth((s) => s.customer);

  const goToTracking = () => {
    clearCart();
    navigation.reset({ index: 0, routes: [{ name: "OrderTracking", params: { orderId: order.id } }] });
  };

  // Paystack checkout. The order only counts as placed once Paystack confirms payment
  // (the server then emails the confirmation and alerts the kitchen).
  const [reference, setReference] = useState<string | null>(null);

  const checkPayment = async (ref: string) => {
    const result: any = await PaymentApi.verify(ref).catch(() => null);
    if (result?.status === "SUCCESS") {
      goToTracking();
      return;
    }
    Alert.alert(
      "Payment not confirmed yet",
      "We haven't received your payment. If you approved it on your phone, wait a moment and check again.",
      [
        { text: "Check again", onPress: () => checkPayment(ref) },
        { text: "Pay again", onPress: () => payWithPaystack() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const payWithPaystack = async () => {
    setLoading(true);
    try {
      const email = customer?.email ?? "customer@qooka.app";
      const init = await PaymentApi.initialize({ orderId: order.id, method: "MOBILE_MONEY", email });
      setReference(init.reference);
      await WebBrowser.openBrowserAsync(init.authorizationUrl);
      await checkPayment(init.reference);
    } catch (e: any) {
      Alert.alert("Payment error", e?.response?.data?.message ?? "Could not start payment.");
    } finally {
      setLoading(false);
    }
  };

  const pay = () => {
    if (SIMULATE_PAYMENTS) setSheet(true);
    else payWithPaystack();
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Payment" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
        <Text style={styles.amountLabel}>Amount to pay</Text>
        <Text style={styles.amount}>{money(order.total)}</Text>
        <Text style={styles.order}>Order {order.orderNumber} · not paid yet</Text>

        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={26} color={colors.brand} />
          </View>
          <Text style={styles.cardTitle}>Secure checkout</Text>
          <Text style={styles.cardText}>
            Pay with MTN MoMo, Telecel Cash or AirtelTigo Money. Your details are handled securely and never stored in the app.
          </Text>
          <View style={styles.methods}>
            {(["phone-portrait-outline", "wallet-outline", "shield-checkmark-outline"] as const).map((ic) => (
              <View key={ic} style={styles.methodPill}>
                <Ionicons name={ic} size={18} color={colors.textSecondary} />
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <PriceActionButton price={money(order.total)} action="Pay Now" onPress={pay} loading={loading} />
        {reference && !loading && (
          <Text style={styles.recheck} onPress={() => checkPayment(reference)}>
            Already paid? Tap to check again
          </Text>
        )}
      </View>

      <MockPaymentSheet
        visible={sheet}
        amount={money(order.total)}
        onCancel={() => setSheet(false)}
        onSuccess={() => {
          setSheet(false);
          goToTracking();
        }}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  amountLabel: { fontSize: 14, color: colors.textMuted, marginTop: 16, textAlign: "center" },
  amount: { fontSize: 42, fontWeight: "900", color: colors.textPrimary, textAlign: "center", marginTop: 4 },
  order: { fontSize: 13, color: colors.textMuted, textAlign: "center", marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: 24, marginTop: 32, alignItems: "center" },
  iconWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  cardText: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 20 },
  methods: { flexDirection: "row", gap: 10, marginTop: 18 },
  methodPill: { width: 46, height: 40, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  footer: { paddingBottom: 12 },
  recheck: { textAlign: "center", color: colors.brand, fontWeight: "800", marginTop: 14 },
});
