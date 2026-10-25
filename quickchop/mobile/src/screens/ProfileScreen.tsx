import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { LEGAL_URL } from "@/api/endpoints";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { GlassCard } from "@/components/GlassCard";
import { PillButton } from "@/components/PillButton";
import { SignInPrompt } from "@/components/SignInPrompt";
import { colors, radii } from "@/theme/glass";
import { RootStackParamList, TabParamList } from "@/navigation/types";
import { useAuth } from "@/store/auth";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;

type IconName = keyof typeof Ionicons.glyphMap;
type Route = keyof RootStackParamList;
const ROWS: { icon: IconName; label: string; route: Route }[] = [
  { icon: "person-outline", label: "Edit profile", route: "EditProfile" },
  { icon: "location-outline", label: "Delivery addresses", route: "DeliveryAddresses" },
  { icon: "notifications-outline", label: "Notifications", route: "Notifications" },
  { icon: "help-circle-outline", label: "Help & support", route: "HelpSupport" },
];

export function ProfileScreen({ navigation }: Props) {
  const customer = useAuth((s) => s.customer);
  const session = useAuth((s) => s.session);
  const signOut = useAuth((s) => s.signOut);

  const email = customer?.email ?? session?.user?.email ?? "";
  const name = customer?.fullName ?? (email ? email.split("@")[0] : "Guest");
  const initial = (name?.[0] ?? "?").toUpperCase();

  if (!session) {
    return (
      <ScreenBackground>
        <Text style={styles.screenTitle}>Profile</Text>
        <SignInPrompt
          emoji="👤"
          message="Sign in to manage your profile, addresses, and more."
          onSignIn={() => navigation.navigate("SignUp")}
        />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}>
        <Text style={styles.screenTitle}>Profile</Text>

        <GlassCard style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name}</Text>
            {!!email && <Text style={styles.email} numberOfLines={1}>{email}</Text>}
          </View>
          <Pressable style={styles.editBtn} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="create-outline" size={18} color={colors.brand} />
          </Pressable>
        </GlassCard>

        <GlassCard style={styles.menuCard} padded={false}>
          {ROWS.map((row, i) => (
            <Pressable
              key={row.label}
              style={[styles.row, i < ROWS.length - 1 && styles.rowDivider]}
              onPress={() => navigation.navigate(row.route as any)}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={row.icon} size={19} color={colors.brand} />
              </View>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </GlassCard>

        <GlassCard style={styles.menuCard} padded={false}>
          {([
            ["shield-checkmark-outline", "Privacy Policy", "customer-privacy"],
            ["document-text-outline", "Terms of Service", "customer-terms"],
          ] as const).map(([icon, label, slug], i) => (
            <Pressable
              key={slug}
              style={[styles.row, i === 0 && styles.rowDivider]}
              onPress={() => Linking.openURL(LEGAL_URL(slug))}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={icon} size={19} color={colors.brand} />
              </View>
              <Text style={styles.rowLabel}>{label}</Text>
              <Ionicons name="open-outline" size={17} color={colors.textMuted} />
            </Pressable>
          ))}
        </GlassCard>

        <PillButton title="Sign out" variant="ghost" onPress={signOut} style={{ marginTop: 22 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  screenTitle: { fontSize: 26, fontWeight: "900", color: colors.textPrimary, marginTop: 6, marginBottom: 16 },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontWeight: "900", color: colors.brand },
  name: { fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  editBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  menuCard: { marginTop: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowIcon: { width: 38, height: 38, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.textPrimary },
});
