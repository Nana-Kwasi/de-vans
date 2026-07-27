import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert, Linking, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PillButton } from "@/components/PillButton";
import { colors, radii, money } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { OrderApi, SupportApi } from "@/api/endpoints";
import { Order } from "@/api/types";

type Props = NativeStackScreenProps<RootStackParamList, "HelpSupport">;

const SUPPORT_EMAIL = "support@quickchop.app";
const TOPICS = ["Order issue", "Payment issue", "Delivery issue", "Account", "Other"];

const FAQ: { q: string; a: string }[] = [
  { q: "How do I place an order?", a: "Browse the menu on Home, tap a dish, choose quantity and add-ons, then Add to Cart. Open your cart and tap Checkout." },
  { q: "Delivery or self-pickup?", a: "At checkout you choose Delivery (enter your address) or Self-pickup (collect from our kitchen). Your choice is sent to the restaurant with your order." },
  { q: "How do I pay?", a: "Payments are handled securely by Paystack. You can pay with card, mobile money, or bank on the Paystack page — we never store your payment details." },
  { q: "Can I track my order?", a: "Yes. After paying, the Track Order screen shows live status: Received → Preparing → Out for delivery → Delivered." },
  { q: "How do I change my password?", a: "Go to Profile → Edit profile → Reset password, enter a new password, and tap Update password." },
  { q: "How do I get a refund or cancel?", a: "Report the order under Help & Support and our team will assist. Refunds are processed back through Paystack." },
];

export function HelpSupportScreen({ navigation }: Props) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [sending, setSending] = useState(false);

  const isOrderIssue = topic === "Order issue";
  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["myOrders"],
    queryFn: OrderApi.mine,
    enabled: isOrderIssue,
  });
  const selectedOrder = orders?.find((o: Order) => o.id === orderId) ?? null;

  const sendReport = async () => {
    if (!message.trim()) return Alert.alert("Add a message", "Tell us what went wrong.");
    if (isOrderIssue && !selectedOrder) return Alert.alert("Pick an order", "Select which order this is about.");
    setSending(true);
    try {
      // Goes straight to the admin dashboard's Support screen.
      await SupportApi.create({ category: topic, orderNumber: selectedOrder?.orderNumber, message: message.trim() });
      setMessage("");
      setOrderId(null);
      Alert.alert("Report sent", "Thanks! Our team will get back to you soon.");
    } catch (e: any) {
      Alert.alert("Couldn't send", e?.response?.data?.message ?? "Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Help & support" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        <Text style={styles.section}>Report an issue</Text>
        <Text style={styles.hint}>Payment, delivery, an order, or anything else — we'll help.</Text>

        <View style={styles.topics}>
          {TOPICS.map((t) => {
            const active = topic === t;
            return (
              <Pressable key={t} style={[styles.chip, active && styles.chipActive]} onPress={() => setTopic(t)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {isOrderIssue && (
          <View style={styles.picker}>
            <Text style={styles.pickerLabel}>Which order is this about?</Text>
            {ordersLoading ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: 12 }} />
            ) : (orders ?? []).length === 0 ? (
              <Text style={styles.noOrders}>You have no orders yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
                {(orders ?? []).map((o: Order) => {
                  const active = o.id === orderId;
                  return (
                    <Pressable key={o.id} style={[styles.orderChip, active && styles.orderChipActive]} onPress={() => setOrderId(o.id)}>
                      <Text style={[styles.orderNo, active && styles.orderNoActive]}>{o.orderNumber}</Text>
                      <Text style={[styles.orderMeta, active && styles.orderMetaActive]}>{money(o.total)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          multiline
          placeholder="Describe the issue (what happened)…"
          placeholderTextColor={colors.textMuted}
        />
        <PillButton title="Send report" onPress={sendReport} loading={sending} style={{ marginTop: 16 }} />

        <Text style={[styles.section, { marginTop: 34 }]}>FAQ</Text>
        {FAQ.map((f, i) => {
          const open = openFaq === i;
          return (
            <Pressable key={f.q} style={styles.faq} onPress={() => setOpenFaq(open ? null : i)}>
              <View style={styles.faqTop}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
              </View>
              {open && <Text style={styles.faqA}>{f.a}</Text>}
            </Pressable>
          );
        })}

        <Pressable style={styles.contact} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          <Ionicons name="mail-outline" size={18} color={colors.brand} />
          <Text style={styles.contactText}>{SUPPORT_EMAIL}</Text>
        </Pressable>
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: "900", color: colors.textPrimary },
  hint: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 14 },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, borderColor: colors.hairline },
  chipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  chipTextActive: { color: colors.brand },
  input: {
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.textPrimary, minHeight: 110, textAlignVertical: "top",
  },
  picker: { marginBottom: 14 },
  pickerLabel: { fontSize: 14, fontWeight: "800", color: colors.textPrimary, marginBottom: 8 },
  noOrders: { fontSize: 14, color: colors.textMuted, marginVertical: 8 },
  orderChip: { backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.hairline, alignItems: "center", minWidth: 96 },
  orderChipActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  orderNo: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  orderNoActive: { color: colors.brand },
  orderMeta: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 2 },
  orderMetaActive: { color: colors.brand },
  faq: { backgroundColor: colors.surface, borderRadius: radii.md, padding: 16, marginBottom: 10 },
  faqTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  faqQ: { flex: 1, fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  faqA: { fontSize: 14, color: colors.textMuted, marginTop: 10, lineHeight: 20 },
  contact: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20 },
  contactText: { fontSize: 15, fontWeight: "700", color: colors.brand },
});
