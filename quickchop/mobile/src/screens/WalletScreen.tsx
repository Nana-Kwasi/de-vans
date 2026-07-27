import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { SignInPrompt } from "@/components/SignInPrompt";
import { colors, radii, money } from "@/theme/glass";
import { RootStackParamList, TabParamList } from "@/navigation/types";
import { OrderApi } from "@/api/endpoints";
import { Order } from "@/api/types";
import { useAuth } from "@/store/auth";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Wallet">,
  NativeStackScreenProps<RootStackParamList>
>;

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function WalletScreen({ navigation }: Props) {
  const session = useAuth((s) => s.session);
  const { data: orders, isLoading, refetch, isRefetching } = useQuery<Order[]>({ queryKey: ["myOrders"], queryFn: OrderApi.mine, enabled: !!session });

  if (!session) {
    return (
      <ScreenBackground>
        <Text style={styles.screenTitle}>Payments</Text>
        <SignInPrompt
          emoji="💳"
          message="Sign in to see your payment history."
          onSignIn={() => navigation.navigate("SignUp")}
        />
      </ScreenBackground>
    );
  }

  // Successful order payments (everything not cancelled). A dedicated
  // /api/payments/me endpoint would give exact SUCCESS/FAILED status per charge.
  const paid = (orders ?? []).filter((o: Order) => o.status !== "CANCELLED");
  const totalSpent = paid.reduce((sum: number, o: Order) => sum + Number(o.total), 0);

  return (
    <ScreenBackground>
      <Text style={styles.screenTitle}>Payments</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total paid via Paystack</Text>
        <Text style={styles.summaryValue}>{money(totalSpent)}</Text>
        <View style={styles.summaryRow}>
          <Ionicons name="shield-checkmark" size={16} color="rgba(255,255,255,0.9)" />
          <Text style={styles.summaryHint}>{paid.length} successful order payment{paid.length === 1 ? "" : "s"}</Text>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={paid}
          keyExtractor={(o) => o.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 18, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
          ListHeaderComponent={paid.length ? <Text style={styles.section}>History</Text> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💳</Text>
              <Text style={styles.emptyTitle}>No payments yet</Text>
              <Text style={styles.emptyText}>Your successful order payments will appear here.</Text>
            </View>
          }
          renderItem={({ item: o }) => (
            <Pressable style={styles.row} onPress={() => navigation.navigate("OrderTracking", { orderId: o.id })}>
              <View style={styles.rowIcon}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Order {o.orderNumber}</Text>
                <Text style={styles.rowSub}>{shortDate(o.createdAt)} · Paystack</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.rowAmount}>{money(o.total)}</Text>
                <Text style={styles.rowPaid}>Paid</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 26, fontWeight: "900", color: colors.textPrimary, marginTop: 12, marginBottom: 16 },
  summaryCard: {
    backgroundColor: colors.brand, borderRadius: radii.xl, padding: 22,
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 4,
  },
  summaryLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
  summaryValue: { color: colors.textOnBrand, fontSize: 34, fontWeight: "900", marginTop: 6 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  summaryHint: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },
  section: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginBottom: 12 },
  empty: { alignItems: "center", justifyContent: "center", marginTop: 60 },
  emptyEmoji: { fontSize: 50, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 14, marginBottom: 12,
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 1,
  },
  rowIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#E9F7F0", alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  rowSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 16, fontWeight: "900", color: colors.textPrimary },
  rowPaid: { fontSize: 12, fontWeight: "700", color: colors.success, marginTop: 2 },
});
