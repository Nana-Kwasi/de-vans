import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, Share, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PriceActionButton } from "@/components/PriceActionButton";
import { QtyStepper } from "@/components/QtyStepper";
import { colors, radii, money } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";
import { useCart } from "@/store/cart";
import { useConfig } from "@/store/config";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { etaLabel, estimateDeliveryFee } from "@/lib/delivery";
import { resolveImageUrl } from "@/lib/config";

type Props = NativeStackScreenProps<RootStackParamList, "ItemDetail">;

function foodEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("jollof") || n.includes("fried rice")) return "🍛";
  if (n.includes("rice")) return "🍚";
  if (n.includes("chicken")) return "🍗";
  return "🍲";
}

export function ItemDetailScreen({ route, navigation }: Props) {
  const { item } = route.params;
  const [qty, setQty] = useState(1);
  const [addOns, setAddOns] = useState("");
  const [liked, setLiked] = useState(false);
  const { coords } = useDeviceLocation();
  const add = useCart((s) => s.add);
  const businessName = useConfig((s) => s.config.businessName);

  const addToCart = () => {
    add(item, qty, addOns.trim() || undefined);
    navigation.navigate("Cart");
  };

  const onShare = () =>
    Share.share({
      message: `Check out ${item.name} on ${businessName} — ${money(item.price)}.${item.description ? ` ${item.description}` : ""}`,
    }).catch(() => undefined);

  return (
    <View style={styles.root}>
      {/* Hero */}
      <View style={styles.hero}>
        {item.photoUrl ? (
          <Image source={{ uri: resolveImageUrl(item.photoUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={styles.heroEmoji}>{foodEmoji(item.name)}</Text>
        )}
        <SafeAreaView style={styles.heroBar} edges={["top"]}>
          <Pressable style={styles.circle} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable style={styles.circle} onPress={() => setLiked((v) => !v)}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={20} color={liked ? colors.brand : colors.textPrimary} />
            </Pressable>
            <Pressable style={styles.circle} onPress={onShare}>
              <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      {/* Content sheet */}
      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={15} color={colors.star} />
            <Text style={styles.ratingText}>4.7</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={15} color={colors.brand} />
            <Text style={styles.metaText}>{etaLabel(coords)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="bicycle-outline" size={15} color={colors.brand} />
            <Text style={styles.metaText}>
              {estimateDeliveryFee(coords) != null ? `Delivery ${money(estimateDeliveryFee(coords) as number)}` : "Delivery"}
            </Text>
          </View>
        </View>

        <Text style={styles.section}>Description</Text>
        <Text style={styles.desc}>{item.description}</Text>

        <Text style={styles.section}>Quantity</Text>
        <QtyStepper value={qty} onChange={setQty} />

        <Text style={styles.section}>Add-ons (optional)</Text>
        <TextInput
          placeholder="e.g. extra chicken, no pepper"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={addOns}
          onChangeText={setAddOns}
        />
      </ScrollView>

      {/* Sticky add-to-cart */}
      <SafeAreaView style={styles.footer} edges={["bottom"]}>
        <PriceActionButton price={money(item.price * qty)} action="Add to Cart" onPress={addToCart} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.brandSoft },
  hero: { height: 300, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 130 },
  heroBar: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 6 },
  circle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3,
  },
  sheet: { flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontSize: 24, fontWeight: "900", color: colors.textPrimary },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  ratingText: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  metaRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceAlt, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.pill },
  metaText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  section: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, marginTop: 24, marginBottom: 10 },
  desc: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.textPrimary,
  },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.hairline },
});
