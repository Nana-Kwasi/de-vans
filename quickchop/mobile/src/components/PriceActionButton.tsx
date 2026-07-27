import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator, View } from "react-native";
import { colors, radii, shadow } from "@/theme/glass";

/** Signature split button: an orange pill showing the price on the left and a
 *  white rounded action pill on the right (e.g. "Add to Cart" / "Checkout"). */
export function PriceActionButton({
  price,
  action,
  onPress,
  loading,
  disabled,
  style,
}: {
  price: string;
  action: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={styles.price}>{price}</Text>
      <View style={styles.action}>
        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          <Text style={styles.actionLabel}>{action}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 62,
    borderRadius: radii.pill,
    backgroundColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 26,
    paddingRight: 6,
    ...shadow,
    shadowColor: colors.brand,
    shadowOpacity: 0.28,
  },
  price: { color: colors.textOnBrand, fontSize: 17, fontWeight: "900" },
  action: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 26,
    height: 50,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  disabled: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.99 }] },
});
