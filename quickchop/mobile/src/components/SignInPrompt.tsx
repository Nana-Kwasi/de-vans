import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PillButton } from "@/components/PillButton";
import { colors } from "@/theme/glass";

/** Shown on account tabs when the user is browsing as a guest. */
export function SignInPrompt({
  title = "Sign in required",
  message,
  emoji = "🔐",
  onSignIn,
}: {
  title?: string;
  message: string;
  emoji?: string;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <PillButton title="Sign in / Create account" onPress={onSignIn} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emoji: { fontSize: 56, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "900", color: colors.textPrimary },
  message: { fontSize: 15, color: colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 21 },
  btn: { alignSelf: "stretch", marginTop: 24 },
});
