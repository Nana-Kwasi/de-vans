import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { MenuApi } from "@/api/endpoints";
import { DrinkType, MenuItem } from "@/api/types";
import { drinkTypeOf, foodEmoji, isDrink } from "@/lib/menu";
import { useCart } from "@/store/cart";
import { colors, radii, money } from "@/theme/glass";
import { DrinkTabs } from "./DrinkTabs";

/**
 * "Add a drink?" strip for the cart: Soft drinks / Local drinks tabs over a row of drinks,
 * each added with one tap. Hidden when the menu has no drinks at all.
 */
export function AddDrinks() {
  const { data: menu } = useQuery({ queryKey: ["menu"], queryFn: MenuApi.list });
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const drinks = useMemo(() => (menu ?? []).filter((m) => m.available && isDrink(m)), [menu]);
  const counts = useMemo(() => ({
    soft: drinks.filter((d) => drinkTypeOf(d) === "soft").length,
    local: drinks.filter((d) => drinkTypeOf(d) === "local").length,
  }), [drinks]);
  // Open on local drinks when there are any — they're the house speciality.
  const [tab, setTab] = useState<DrinkType>(counts.local > 0 ? "local" : "soft");

  if (drinks.length === 0) return null;
  const shown = drinks.filter((d) => drinkTypeOf(d) === tab);
  const qtyOf = (m: MenuItem) => lines.find((l) => l.item.id === m.id)?.quantity ?? 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Add a drink?</Text>
      <DrinkTabs value={tab} onChange={setTab} counts={counts} />
      {shown.length === 0 ? (
        <Text style={styles.empty}>No {tab === "local" ? "local" : "soft"} drinks right now.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {shown.map((d) => {
            const qty = qtyOf(d);
            return (
              <View key={d.id} style={styles.card}>
                <View style={styles.thumb}>
                  {d.photoUrl ? <Image source={{ uri: d.photoUrl }} style={styles.img} /> : <Text style={styles.thumbEmoji}>{foodEmoji(d.name)}</Text>}
                </View>
                <Text style={styles.name} numberOfLines={2}>{d.name}</Text>
                <View style={styles.bottom}>
                  <Text style={styles.price}>{money(d.price)}</Text>
                  <Pressable onPress={() => add(d, 1)} style={styles.add} hitSlop={6} accessibilityLabel={`Add ${d.name}`}>
                    {qty > 0 ? <Text style={styles.addQty}>{qty}</Text> : <Ionicons name="add" size={18} color={colors.textOnBrand} />}
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 },
  title: { fontSize: 17, fontWeight: "900", color: colors.textPrimary, marginBottom: 10 },
  empty: { color: colors.textMuted, fontWeight: "600", marginTop: 14, textAlign: "center" },
  row: { gap: 12, paddingTop: 12, paddingRight: 8 },
  card: { width: 132, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 10 },
  thumb: { height: 84, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  thumbEmoji: { fontSize: 34 },
  name: { marginTop: 8, fontSize: 13, fontWeight: "800", color: colors.textPrimary, minHeight: 34 },
  bottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  price: { fontSize: 13, fontWeight: "900", color: colors.brand },
  add: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  addQty: { color: colors.textOnBrand, fontWeight: "900" },
});
