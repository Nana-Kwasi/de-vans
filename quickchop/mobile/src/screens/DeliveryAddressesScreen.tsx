import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PillButton } from "@/components/PillButton";
import { colors, radii } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { usePrefs } from "@/store/prefs";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryAddresses">;

export function DeliveryAddressesScreen({ navigation }: Props) {
  const { addresses, selectedId, addAddress, removeAddress, select } = usePrefs();
  const [label, setLabel] = useState("Home");
  const [address, setAddress] = useState("");

  const save = () => {
    if (!address.trim()) return Alert.alert("Address needed", "Enter the full address.");
    addAddress(label.trim() || "Address", address.trim());
    setAddress("");
    setLabel("Home");
  };

  return (
    <ScreenBackground avoidKeyboard>
      <ScreenHeader title="Delivery addresses" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📍</Text>
            <Text style={styles.emptyText}>No saved addresses yet.</Text>
          </View>
        ) : (
          addresses.map((a) => {
            const active = a.id === selectedId;
            return (
              <Pressable key={a.id} style={[styles.card, active && styles.cardActive]} onPress={() => select(a.id)}>
                <View style={styles.cardIcon}>
                  <Ionicons name="location" size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>{a.label}</Text>
                  <Text style={styles.cardAddr} numberOfLines={2}>{a.address}</Text>
                </View>
                <Pressable hitSlop={8} onPress={() => removeAddress(a.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </Pressable>
            );
          })
        )}

        <Text style={styles.section}>Add new address</Text>
        <Text style={styles.fieldLabel}>Label</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Home, Work…" placeholderTextColor={colors.textMuted} />
        <Text style={styles.fieldLabel}>Address</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={address} onChangeText={setAddress} multiline placeholder="House number, street, area" placeholderTextColor={colors.textMuted} />
        <PillButton title="Save address" onPress={save} style={{ marginTop: 20 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", marginTop: 30, marginBottom: 10 },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyText: { color: colors.textMuted, fontWeight: "600" },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: colors.hairline },
  cardActive: { borderColor: colors.brand },
  cardIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
  cardAddr: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  section: { fontSize: 18, fontWeight: "900", color: colors.textPrimary, marginTop: 24, marginBottom: 4 },
  fieldLabel: { marginTop: 16, marginBottom: 8, fontWeight: "800", color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textPrimary, textAlignVertical: "top",
  },
});
