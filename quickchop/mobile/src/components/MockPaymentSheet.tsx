import React, { useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "@/theme/glass";

type IconName = keyof typeof Ionicons.glyphMap;
type Stage = "select" | "processing" | "success";

// Mobile money only — that is what customers here actually pay with, and offering a
// card option the business does not accept just creates failed checkouts.
const METHODS: { key: string; icon: IconName; label: string; detail: string }[] = [
  { key: "MOMO", icon: "phone-portrait", label: "MTN Mobile Money", detail: "Pay with MoMo" },
  { key: "MOMO_VODA", icon: "phone-portrait", label: "Telecel Cash", detail: "Pay with Telecel Cash" },
  { key: "MOMO_ATL", icon: "phone-portrait", label: "AirtelTigo Money", detail: "Pay with AT Money" },
];

/**
 * Simulated payment sheet — mimics a real checkout while Paystack keys aren't
 * live yet. It never charges anything and never collects real card details.
 */
export function MockPaymentSheet({
  visible,
  amount,
  onCancel,
  onSuccess,
}: {
  visible: boolean;
  amount: string;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState("MOMO");
  const [stage, setStage] = useState<Stage>("select");

  const pay = () => {
    setStage("processing");
    setTimeout(() => {
      setStage("success");
      setTimeout(() => {
        setStage("select");
        onSuccess();
      }, 1300);
    }, 1900);
  };

  const close = () => {
    if (stage === "processing") return;
    setStage("select");
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {stage === "success" ? (
            <View style={styles.center}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={44} color={colors.textOnBrand} />
              </View>
              <Text style={styles.successTitle}>Payment successful</Text>
              <Text style={styles.successText}>{amount} paid</Text>
            </View>
          ) : stage === "processing" ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.brand} />
              <Text style={styles.successTitle}>Processing payment…</Text>
              <Text style={styles.successText}>Please wait a moment</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.testBadge}>
                  <Ionicons name="flask" size={13} color={colors.brand} />
                  <Text style={styles.testText}>Test mode · no real charge</Text>
                </View>
                <Pressable onPress={close} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              <Text style={styles.amountLabel}>Amount to pay</Text>
              <Text style={styles.amount}>{amount}</Text>

              <Text style={styles.section}>Pay with</Text>
              {METHODS.map((m) => {
                const active = method === m.key;
                return (
                  <Pressable key={m.key} style={[styles.method, active && styles.methodActive]} onPress={() => setMethod(m.key)}>
                    <View style={styles.methodIcon}>
                      <Ionicons name={m.icon} size={19} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodLabel}>{m.label}</Text>
                      <Text style={styles.methodDetail}>{m.detail}</Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioOn]}>
                      {active && <Ionicons name="checkmark" size={13} color={colors.textOnBrand} />}
                    </View>
                  </Pressable>
                );
              })}

              <Pressable style={styles.payBtn} onPress={pay}>
                <Text style={styles.payText}>Pay {amount}</Text>
              </Pressable>
              <Text style={styles.secured}>🔒 Secured checkout · Paystack (coming soon)</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  testBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  testText: { color: colors.brand, fontWeight: "800", fontSize: 12 },
  amountLabel: { fontSize: 13, color: colors.textMuted, textAlign: "center" },
  amount: { fontSize: 36, fontWeight: "900", color: colors.textPrimary, textAlign: "center", marginTop: 2 },
  section: { fontSize: 15, fontWeight: "800", color: colors.textPrimary, marginTop: 22, marginBottom: 12 },
  method: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface,
    borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.hairline, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10,
  },
  methodActive: { borderColor: colors.brand },
  methodIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  methodLabel: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  methodDetail: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.hairline, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  payBtn: { height: 56, borderRadius: radii.pill, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 12 },
  payText: { color: colors.textOnBrand, fontSize: 17, fontWeight: "900" },
  secured: { textAlign: "center", fontSize: 12, color: colors.textMuted, marginTop: 12 },
  center: { alignItems: "center", paddingVertical: 30 },
  successCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.success, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: "900", color: colors.textPrimary, marginTop: 8 },
  successText: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
});
