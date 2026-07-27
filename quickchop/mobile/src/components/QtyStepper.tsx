import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii } from "@/theme/glass";

/** Compact quantity stepper: a light pill with a minus, the value, and an
 *  orange plus circle (matches the reference cart design). */
export function QtyStepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const atMin = value <= min;
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, styles.minus, atMin && styles.minusDisabled]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
      >
        <Ionicons name="remove" size={18} color={atMin ? colors.textMuted : colors.textPrimary} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable style={[styles.btn, styles.plus]} onPress={() => onChange(value + 1)}>
        <Ionicons name="add" size={18} color={colors.textOnBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  btn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  minus: { backgroundColor: colors.surface },
  minusDisabled: { backgroundColor: colors.surfaceAlt },
  plus: { backgroundColor: colors.brand },
  value: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, minWidth: 34, textAlign: "center" },
});
