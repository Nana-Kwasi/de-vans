import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from "react-native";
import { colors, radii, shadow } from "@/theme/glass";

export function PillButton({
  title,
  onPress,
  variant = "solid",
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "solid" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isSolid = variant === "solid";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isSolid ? styles.solid : styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSolid ? colors.textOnBrand : colors.brand} />
      ) : (
        <Text style={[styles.label, isSolid ? styles.labelSolid : styles.labelGhost]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  solid: { backgroundColor: colors.brand, ...shadow, shadowColor: colors.brand, shadowOpacity: 0.28 },
  ghost: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ scale: 0.98 }] },
  label: { fontSize: 16, fontWeight: "800" },
  labelSolid: { color: colors.textOnBrand },
  labelGhost: { color: colors.brand },
});
