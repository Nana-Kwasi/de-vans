import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, RefreshControl, Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { CompositeScreenProps } from "@react-navigation/native";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ScreenBackground } from "@/components/ScreenBackground";
import { PillButton } from "@/components/PillButton";
import { colors, radii, money } from "@/theme/glass";
import { resolveImageUrl } from "@/lib/config";
import { RootStackParamList, TabParamList } from "@/navigation/types";
import { MenuItem } from "@/api/types";
import { MenuApi } from "@/api/endpoints";
import { CATEGORIES, inCategory, foodEmoji, drinkTypeOf, isDrink } from "@/lib/menu";
import { DrinkTabs } from "@/components/DrinkTabs";
import { DrinkType } from "@/api/types";
import { useCart } from "@/store/cart";
import { useConfig } from "@/store/config";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { usePrefs } from "@/store/prefs";
import { useNotificationFeed } from "@/hooks/useNotificationFeed";
import { usePushToken } from "@/hooks/usePushToken";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Home">,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  usePushToken();
  const location = useDeviceLocation();
  const setDetected = usePrefs((st) => st.setDetected);
  // Unread order updates, shown as a count on the bell so there is a reason to open it.
  const { unreadCount } = useNotificationFeed();

  // Share the detected location with the rest of the app so checkout can prefill the
  // delivery address instead of making the customer retype where they already are.
  useEffect(() => {
    if (!location.loading && !location.denied && location.coords) {
      setDetected(location.label, location.coords);
    }
  }, [location.loading, location.denied, location.label, location.coords, setDetected]);
  const { data: menu, isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ["menu"], queryFn: MenuApi.list });
  const count = useCart((s) => s.count());
  const config = useConfig((s) => s.config);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [drinkTab, setDrinkTab] = useState<DrinkType>("soft");

  const sortByNewestFirst = (items: MenuItem[]) =>
    [...items].sort((a, b) => {
      const timeA = a.createdAt ? Date.parse(a.createdAt) : 0;
      const timeB = b.createdAt ? Date.parse(b.createdAt) : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.name.localeCompare(b.name);
    });

  const sortedMenu = useMemo(() => sortByNewestFirst(menu ?? []), [menu]);
  const featuredItems = useMemo(() => sortedMenu.filter((m: MenuItem) => m.featured), [sortedMenu]);
  const promoItem = featuredItems[0] ?? sortedMenu[0];
  const filtered = useMemo(() => {
    let list: MenuItem[] = sortedMenu;
    if (category !== "all") list = list.filter((m: MenuItem) => inCategory(m, category));
    if (category === "drinks") list = list.filter((m: MenuItem) => drinkTypeOf(m) === drinkTab);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((m: MenuItem) => m.name.toLowerCase().includes(q) || (m.description ?? "").toLowerCase().includes(q));
    }
    return sortByNewestFirst(list);
  }, [sortedMenu, category, query, drinkTab]);
  const drinkCounts = useMemo(() => {
    const drinks = sortedMenu.filter(isDrink);
    return {
      soft: drinks.filter((d) => drinkTypeOf(d) === "soft").length,
      local: drinks.filter((d) => drinkTypeOf(d) === "local").length,
    };
  }, [sortedMenu]);

  return (
    <ScreenBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 6 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.brand} colors={[colors.brand]} />}
      >
        {/* Location + cart */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deliverTo}>Deliver to</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location" size={16} color={colors.brand} />
              {location.loading ? (
                <ActivityIndicator size="small" color={colors.brand} style={{ marginHorizontal: 4 }} />
              ) : (
                <Text style={styles.location} numberOfLines={1}>{location.label}</Text>
              )}
              <Ionicons name="chevron-down" size={16} color={colors.textPrimary} />
            </View>
          </View>
          <Pressable style={styles.cartBtn} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.cartBtn} onPress={() => navigation.navigate("Cart")}>
            <Ionicons name="bag-handle-outline" size={22} color={colors.textPrimary} />
            {count > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{count}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Closed / announcement banners (admin-controlled) */}
        {!config.acceptingOrders && (
          <View style={[styles.banner, styles.bannerClosed]}>
            <Ionicons name="alert-circle" size={18} color="#B91C1C" />
            <Text style={[styles.bannerText, { color: "#B91C1C" }]}>{config.closedMessage}</Text>
          </View>
        )}
        {config.announcementEnabled && !!config.announcementText && (
          <View style={[styles.banner, styles.bannerInfo]}>
            <Ionicons name="megaphone-outline" size={18} color={colors.brand} />
            <Text style={[styles.bannerText, { color: colors.textPrimary }]}>{config.announcementText}</Text>
          </View>
        )}

        {/* Search + filter */}
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Search dishes"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <Pressable style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={colors.textOnBrand} />
          </Pressable>
        </View>

        {/* Promo card — title, copy, button label and image all set by the admin.
            The image falls back to the featured dish's own photo when none is set. */}
        {config.promoEnabled && promoItem && (
          <View style={styles.promo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>{config.promoTitle}</Text>
              <Text style={styles.promoText}>{config.promoText}</Text>
              <Pressable style={styles.promoBtn} onPress={() => navigation.navigate("ItemDetail", { item: promoItem })}>
                <Text style={styles.promoBtnText}>{config.promoCta}</Text>
              </Pressable>
            </View>
            {config.promoImageUrl || promoItem.photoUrl ? (
              <Image
                source={{ uri: resolveImageUrl(config.promoImageUrl || promoItem.photoUrl) }}
                style={styles.promoImg}
              />
            ) : (
              <Text style={styles.promoEmoji}>{foodEmoji(promoItem.name)}</Text>
            )}
          </View>
        )}

        {/* Hot meals — admin-featured items */}
        {featuredItems.length > 0 && (
          <View style={{ marginBottom: 22 }}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>🔥 Hot meals</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
              {featuredItems.map((item: MenuItem) => (
                <Pressable key={item.id} style={styles.hotCard} onPress={() => navigation.navigate("ItemDetail", { item })}>
                  <View style={styles.hotThumb}>
                    {item.photoUrl ? (
                      <Image source={{ uri: resolveImageUrl(item.photoUrl) }} style={styles.thumbImg} />
                    ) : (
                      <Text style={{ fontSize: 40 }}>{foodEmoji(item.name)}</Text>
                    )}
                  </View>
                  <Text style={styles.hotName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.price}>{money(item.price)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <Pressable key={c.key} style={[styles.cat, active && styles.catActive]} onPress={() => setCategory(c.key)}>
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Drinks split into two shelves: bottled soft drinks and Ghanaian local drinks. */}
        {category === "drinks" && (
          <View style={{ marginTop: -8, marginBottom: 18 }}>
            <DrinkTabs value={drinkTab} onChange={setDrinkTab} counts={drinkCounts} />
          </View>
        )}

        {/* Menu list */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {category === "all"
              ? "Picks For You"
              : category === "drinks"
              ? drinkTab === "local" ? "Local drinks" : "Soft drinks"
              : CATEGORIES.find((c) => c.key === category)?.label}
          </Text>
          <Text style={styles.seeAll}>{filtered.length} items</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>Couldn't load the menu.</Text>
            <PillButton title="Retry" variant="ghost" onPress={() => refetch()} style={{ marginTop: 12 }} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateEmoji}>🍽️</Text>
            <Text style={styles.stateText}>
              {category === "drinks" ? `No ${drinkTab === "local" ? "local" : "soft"} drinks yet.` : "No dishes in this category yet."}
            </Text>
          </View>
        ) : (
          filtered.map((item: MenuItem) => (
            <Pressable key={item.id} style={styles.card} onPress={() => navigation.navigate("ItemDetail", { item })}>
              <View style={styles.thumb}>
                {item.photoUrl ? (
                  <Image source={{ uri: resolveImageUrl(item.photoUrl) }} style={styles.thumbImg} />
                ) : (
                  <Text style={styles.thumbEmoji}>{foodEmoji(item.name)}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.rating}>
                    <Ionicons name="star" size={13} color={colors.star} />
                    <Text style={styles.ratingText}>4.7</Text>
                  </View>
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.cardBottom}>
                  <Text style={styles.price}>{money(item.price)}</Text>
                  <View style={styles.addBtn}>
                    <Ionicons name="add" size={20} color={colors.textOnBrand} />
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  deliverTo: { fontSize: 12, color: colors.textMuted, fontWeight: "600", marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  location: { fontSize: 16, fontWeight: "800", color: colors.textPrimary, maxWidth: 240 },
  cartBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2, marginLeft: 8,
  },
  badge: {
    position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 2, borderColor: colors.bg,
  },
  badgeText: { color: colors.textOnBrand, fontSize: 11, fontWeight: "800" },

  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, marginBottom: 14 },
  bannerClosed: { backgroundColor: "#FEE2E2" },
  bannerInfo: { backgroundColor: colors.brandSoft },
  bannerText: { flex: 1, fontSize: 13, fontWeight: "700" },
  searchRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  search: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 16, height: 52,
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary },
  filterBtn: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },

  promo: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, borderRadius: radii.xl, padding: 20, marginBottom: 22,
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 4,
  },
  promoTitle: { color: colors.textOnBrand, fontSize: 19, fontWeight: "900" },
  promoText: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 6, marginBottom: 14, lineHeight: 18 },
  promoBtn: { alignSelf: "flex-start", backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 20, paddingVertical: 9 },
  promoBtnText: { color: colors.brand, fontWeight: "800", fontSize: 13 },
  promoImg: { width: 90, height: 90, borderRadius: radii.md, marginLeft: 6 },
  promoEmoji: { fontSize: 58, marginLeft: 6 },

  catRow: { gap: 12, paddingRight: 8, marginBottom: 22 },
  cat: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: 16, gap: 4, minWidth: 74 },
  catActive: { backgroundColor: colors.brandSoft },
  catEmoji: { fontSize: 22 },
  catLabel: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  catLabelActive: { color: colors.brand },

  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: "900", color: colors.textPrimary },
  seeAll: { fontSize: 13, fontWeight: "700", color: colors.textMuted },

  stateCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: 24, alignItems: "center" },
  stateEmoji: { fontSize: 40, marginBottom: 8 },
  stateText: { color: colors.textSecondary, fontWeight: "600" },

  card: {
    flexDirection: "row", gap: 14, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 12, marginBottom: 14, alignItems: "center",
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2,
  },
  thumb: { width: 84, height: 84, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  thumbEmoji: { fontSize: 40 },
  hotCard: {
    width: 152, backgroundColor: colors.surface, borderRadius: radii.lg, padding: 10,
    shadowColor: "#0B0B0F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2,
  },
  hotThumb: { width: "100%", height: 100, borderRadius: radii.md, backgroundColor: colors.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 8 },
  hotName: { fontSize: 14, fontWeight: "800", color: colors.textPrimary },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardName: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  cardDesc: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  price: { fontSize: 17, fontWeight: "900", color: colors.brand },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
