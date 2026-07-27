import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, Pressable, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { GlassCard } from "@/components/GlassCard";
import { PillButton } from "@/components/PillButton";
import { colors, heading, subheading, radii } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { CustomerApi } from "@/api/endpoints";
import { useAuth } from "@/store/auth";

type Mode = "signup" | "signin";
type Props = NativeStackScreenProps<RootStackParamList, "SignUp">;

export function SignUpScreen({ navigation }: Props) {
  const dismiss = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Main"));
  const [mode, setMode] = useState<Mode>("signup");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const setCustomer = useAuth((s) => s.setCustomer);

  // Create (or refresh) the backend profile once we have an authenticated session.
  const ensureProfile = async (nameHint?: string, phoneHint?: string) => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.email) return;
    const name =
      nameHint?.trim() ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email.split("@")[0];
    try {
      const customer = await CustomerApi.createProfile({
        fullName: name,
        email: user.email,
        phoneNumber: phoneHint?.trim() || undefined,
      });
      setCustomer(customer);
    } catch {
      // Profile may already exist; the session alone is enough to proceed.
    }
  };

  const submitEmail = async () => {
    if (!email.trim() || !password) {
      return Alert.alert("Missing info", "Enter your email and password.");
    }
    if (mode === "signup" && (!fullName.trim() || !phone.trim())) {
      return Alert.alert("Missing info", "Enter your full name and phone number.");
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          await ensureProfile(fullName, phone); // email confirmation is off → straight in
          dismiss();
        } else {
          Alert.alert(
            "Confirm your email",
            "We sent you a confirmation link. Tap it, then sign in.",
            [{ text: "OK", onPress: () => setMode("signin") }]
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await ensureProfile(fullName);
        dismiss();
      }
    } catch (e: any) {
      Alert.alert("Authentication failed", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const submitGoogle = async () => {
    setGoogleLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session) {
        await ensureProfile();
        dismiss();
      }
    } catch (e: any) {
      Alert.alert("Google sign-in failed", e?.message ?? "Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <ScreenBackground>
      <Pressable style={styles.close} onPress={dismiss} hitSlop={8}>
        <Ionicons name="close" size={22} color={colors.textPrimary} />
      </Pressable>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.center}
      >
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/qooka-logo.jpeg")} style={styles.logo} resizeMode="cover" />
        </View>
        <Text style={[subheading, styles.tagline]}>Home-cooked meals, delivered warm.</Text>

        <GlassCard style={styles.card}>
          <Text style={heading}>{isSignup ? "Create account" : "Welcome back"}</Text>
          <Text style={subheading}>
            {isSignup ? "Sign up to start ordering" : "Sign in to your account"}
          </Text>

          {isSignup && (
            <>
              <TextInput
                placeholder="Full name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                placeholder="Phone number (+233 …)"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
              />
            </>
          )}
          <TextInput
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          <PillButton
            title={isSignup ? "Create account" : "Sign in"}
            onPress={submitEmail}
            loading={loading}
            style={{ marginTop: 18 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <PillButton
            title="Continue with Google"
            variant="ghost"
            onPress={submitGoogle}
            loading={googleLoading}
          />

          <Pressable onPress={() => setMode(isSignup ? "signin" : "signup")} style={styles.switch}>
            <Text style={styles.switchText}>
              {isSignup ? "Already have an account? " : "New here? "}
              <Text style={styles.switchLink}>{isSignup ? "Sign in" : "Create account"}</Text>
            </Text>
          </Pressable>
        </GlassCard>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  close: { position: "absolute", top: 8, right: 4, width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", zIndex: 10 },
  center: { flex: 1, justifyContent: "center" },
  logoWrap: { alignSelf: "center", height: 84, width: 84, borderRadius: 22, overflow: "hidden", backgroundColor: "#fff", shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  logo: { height: "100%", width: "100%" },
  brand: { fontSize: 40, fontWeight: "900", color: colors.brand, textAlign: "center" },
  tagline: { textAlign: "center", marginBottom: 24, color: colors.textMuted },
  card: { padding: 8 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 14,
  },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 16 },
  divider: { flex: 1, height: 1, backgroundColor: colors.hairline },
  dividerText: { marginHorizontal: 12, color: colors.textMuted, fontWeight: "700" },
  switch: { marginTop: 18, alignItems: "center" },
  switchText: { color: colors.textMuted, fontWeight: "600" },
  switchLink: { color: colors.brand, fontWeight: "900" },
});
