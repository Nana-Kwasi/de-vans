import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { DrinkType } from "@/api/types";
import { DRINK_TABS } from "@/lib/menu";
import { colors, radii } from "@/theme/glass";

/** Two top tabs splitting drinks into Soft drinks and Local drinks. */
export function DrinkTabs({
  value,
  onChange,
  counts,
}: {
  value: DrinkType;
  onChange: (t: DrinkType) => void;
  counts?: Partial<Record<DrinkType, number>>;
}) {
  return (
    <View style={styles.wrap}>
      {DRINK_TABS.map((t) => {
        const active = value === t.key;
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={[styles.tab, active && styles.tabActive]}>
            <Text style={styles.emoji}>{t.emoji}</Text>
            <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
            {counts?.[t.key] != null && (
              <View style={[styles.badge, active && styles.badgeActive]}>
                <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{counts[t.key]}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.pill, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: radii.pill },
  tabActive: { backgroundColor: colors.brand },
  emoji: { fontSize: 15 },
  label: { fontSize: 14, fontWeight: "800", color: colors.textSecondary },
  labelActive: { color: colors.textOnBrand },
  badge: { minWidth: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: "center" },
  badgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  badgeText: { fontSize: 11, fontWeight: "800", color: colors.textMuted },
  badgeTextActive: { color: colors.textOnBrand },
});
