import React, { useEffect, useState } from "react";
import { Modal, View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { PolicyApi } from "@/api/endpoints";
import { onPoliciesRequired } from "@/api/client";
import { useAuth } from "@/store/auth";
import { PillButton } from "@/components/PillButton";
import { MarkdownText } from "@/components/MarkdownText";
import { colors, radii } from "@/theme/glass";

/**
 * Full-screen "read and accept" step for signed-in customers who haven't accepted the
 * current Privacy Policy and Terms (first sign-in, or after a new version is published).
 * The server records the acceptance with time, IP, device and a fingerprint of the text,
 * and refuses orders until it exists.
 */
export function PolicyGate() {
  const session = useAuth((s) => s.session);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["policies", session?.user?.id],
    queryFn: PolicyApi.status,
    // Fails (404) until the customer profile exists — then the gate stays hidden and the
    // next refetch (or a refused order) brings it up.
    enabled: !!session,
    retry: false,
    refetchInterval: 5 * 60_000,
  });
  useEffect(() => onPoliciesRequired(() => refetch()), [refetch]);
  // A new account's profile is created just after sign-up: check again as soon as it exists.
  const customerId = useAuth((s) => s.customer?.id);
  useEffect(() => {
    if (session && customerId) refetch();
  }, [customerId]);

  const pending = (data ?? []).filter((s) => !s.accepted);
  const visible = !!session && pending.length > 0;
  const updated = (data ?? []).some((s) => s.accepted) || pending.some((s) => s.policy.version > 1);

  useEffect(() => {
    if (visible) {
      setAgreed(false);
      setOpen(pending[0]?.policy.id ?? null);
    }
  }, [visible, pending.map((p) => p.policy.id).join()]);

  const accept = async () => {
    setSaving(true);
    try {
      const result = await PolicyApi.accept(pending.map((s) => s.policy.id));
      qc.setQueryData(["policies", session?.user?.id], result);
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.response?.data?.message ?? "Please try again.");
      refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <View style={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.title}>{updated ? "We've updated our policies" : "Before you order"}</Text>
        <Text style={styles.sub}>Please read and accept these to keep using Qooka Qooks.</Text>

        <ScrollView style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {pending.map((s) => {
            const expanded = open === s.policy.id;
            return (
              <View key={s.policy.id} style={styles.card}>
                <Pressable style={styles.cardHead} onPress={() => setOpen(expanded ? null : s.policy.id)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{s.policy.title}</Text>
                    <Text style={styles.cardMeta}>
                      Version {s.policy.version}
                      {s.policy.version > 1 && s.policy.changeSummary ? ` · ${s.policy.changeSummary}` : ""}
                    </Text>
                  </View>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
                </Pressable>
                {expanded && (
                  <View style={styles.cardBody}>
                    <MarkdownText source={s.policy.content} />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <Pressable style={styles.agree} onPress={() => setAgreed((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
          <Ionicons name={agreed ? "checkbox" : "square-outline"} size={24} color={agreed ? colors.brand : colors.textMuted} />
          <Text style={styles.agreeText}>I have read and agree to the {pending.map((s) => s.policy.title).join(" and ")}.</Text>
        </Pressable>
        <PillButton title="Accept and continue" onPress={accept} disabled={!agreed} loading={saving} style={{ marginTop: 12 }} />
        <Pressable onPress={() => useAuth.getState().signOut()} style={{ marginTop: 12, alignItems: "center" }}>
          <Text style={styles.signOut}>Not now — sign out</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: "900", color: colors.textPrimary },
  sub: { marginTop: 4, color: colors.textSecondary, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, marginBottom: 12, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.hairline },
  agree: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface, borderRadius: radii.md, padding: 14 },
  agreeText: { flex: 1, color: colors.textPrimary, fontWeight: "600", lineHeight: 20 },
  signOut: { color: colors.textMuted, fontWeight: "700" },
});
