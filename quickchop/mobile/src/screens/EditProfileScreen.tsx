import React, { useEffect, useRef, useState } from "react";
import { Text, TextInput, StyleSheet, ScrollView, Alert, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScreenBackground } from "@/components/ScreenBackground";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PillButton } from "@/components/PillButton";
import { colors, radii } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/store/auth";
import { CustomerApi } from "@/api/endpoints";
import { Customer } from "@/api/types";
import { supabase } from "@/lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
  const customer = useAuth((s) => s.customer);
  const session = useAuth((s) => s.session);
  const setCustomer = useAuth((s) => s.setCustomer);

  // Pull the saved profile from the backend so the fields show real bio data.
  const { data: me, isLoading } = useQuery<Customer>({
    queryKey: ["me"],
    queryFn: CustomerApi.me,
    retry: false,
  });

  const email = me?.email ?? customer?.email ?? session?.user?.email ?? "";
  const [fullName, setFullName] = useState(customer?.fullName ?? "");
  const [phone, setPhone] = useState(customer?.phoneNumber ?? "");
  const [address, setAddress] = useState(customer?.defaultAddress ?? "");
  const [password, setPassword] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const inited = useRef(false);

  useEffect(() => {
    if (me && !inited.current) {
      inited.current = true;
      setFullName(me.fullName ?? "");
      setPhone(me.phoneNumber ?? "");
      setAddress(me.defaultAddress ?? "");
      setCustomer(me);
    }
  }, [me, setCustomer]);

  const saveBio = async () => {
    setSavingBio(true);
    try {
      // createProfile is an upsert on the backend, so this persists real edits.
      const saved = await CustomerApi.createProfile({
        fullName: fullName.trim() || (email ? email.split("@")[0] : "Guest"),
        email,
        phoneNumber: phone.trim() || undefined,
        defaultAddress: address.trim() || undefined,
      });
      setCustomer(saved);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.response?.data?.message ?? "Please try again.");
    } finally {
      setSavingBio(false);
    }
  };

  const changePassword = async () => {
    if (password.length < 6) return Alert.alert("Weak password", "Use at least 6 characters.");
    setSavingPass(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      Alert.alert("Password updated", "Your password has been changed.");
    } catch (e: any) {
      Alert.alert("Couldn't update password", e?.message ?? "Please try again.");
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <ScreenBackground>
      <ScreenHeader title="Edit profile" onBack={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
        <Text style={styles.section}>Your details</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder={isLoading ? "Loading…" : "Your name"} placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Email</Text>
        <View style={[styles.input, styles.readonly]}>
          <Text style={styles.readonlyText}>{email || "—"}</Text>
        </View>

        <Text style={styles.label}>Phone number</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+233 …" placeholderTextColor={colors.textMuted} />

        <Text style={styles.label}>Default delivery address</Text>
        <TextInput style={[styles.input, { height: 80 }]} value={address} onChangeText={setAddress} multiline placeholder="House number, street, area" placeholderTextColor={colors.textMuted} />

        <PillButton title="Save changes" onPress={saveBio} loading={savingBio} style={{ marginTop: 22 }} />

        <Text style={[styles.section, { marginTop: 34 }]}>Reset password</Text>
        <Text style={styles.label}>New password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="At least 6 characters" placeholderTextColor={colors.textMuted} />
        <PillButton title="Update password" variant="ghost" onPress={changePassword} loading={savingPass} style={{ marginTop: 18 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: "900", color: colors.textPrimary, marginTop: 6 },
  label: { marginTop: 18, marginBottom: 8, fontWeight: "800", color: colors.textPrimary },
  input: {
    backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.textPrimary, textAlignVertical: "top",
  },
  readonly: { backgroundColor: colors.surfaceAlt, justifyContent: "center" },
  readonlyText: { fontSize: 16, color: colors.textMuted },
});
