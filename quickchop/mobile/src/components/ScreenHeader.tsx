import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/theme/glass";

/** A simple header row with a circular back button, a centered title, and an
 *  optional right-side element — matches the reference detail/cart screens. */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.circle} onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <View style={styles.right}>{right ?? <View style={styles.circlePlaceholder} />}</View>
    </View>
  );
}

const SIZE = 42;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0B0B0F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  circlePlaceholder: { width: SIZE, height: SIZE },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary },
  right: { minWidth: SIZE, alignItems: "flex-end" },
});
