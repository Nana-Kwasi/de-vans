import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { card, colors, radii } from "@/theme/glass";

/** A white surface card with a soft shadow.
 *  (Name kept as GlassCard for import compatibility across screens.)
 *  tone="dark" renders a dark charcoal card for white text. */
export function GlassCard({
  children,
  style,
  tone = "light",
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: "light" | "dark";
  padded?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <View style={[card, dark && styles.dark, style]}>
      <View style={padded && styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 16 },
  dark: { backgroundColor: "#26262B", borderRadius: radii.lg, borderWidth: 0 },
});
