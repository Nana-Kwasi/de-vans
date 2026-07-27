import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "@/theme/glass";
import { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

const { width, height } = Dimensions.get("window");

const SLIDES = [
  {
    image: require("../../assets/app-home-1.jpg"),
    title: "Delicious meals,\ndelivered warm",
    subtitle: "Order your favourite dishes and track them to your door.",
  },
  {
    image: require("../../assets/app-home-2.jpg"),
    title: "Freshly cooked,\njust for you",
    subtitle: "Browse the menu, pay securely, and eat happy.",
  },
];

export function WelcomeScreen({ navigation }: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const enter = async () => {
    await AsyncStorage.setItem("qooka.seenWelcome", "1");
    navigation.replace("Main");
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToOffset({ offset: (index + 1) * width, animated: true });
    } else {
      enter();
    }
  };

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <Image source={item.image} style={{ width, height }} resizeMode="cover" />
          </View>
        )}
      />

      {/* Readability gradient over the imagery */}
      <LinearGradient
        colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.75)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.overlay}>
        {/* Top: logo + skip */}
        <View style={styles.top}>
          <View style={styles.logoWrap}>
            <Image source={require("../../assets/qooka-logo.jpeg")} style={styles.logo} resizeMode="cover" />
          </View>
          <Pressable onPress={enter} hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        {/* Bottom: copy + dots + arrow */}
        <View style={styles.bottom}>
          <Text style={styles.title}>{SLIDES[index].title}</Text>
          <Text style={styles.subtitle}>{SLIDES[index].subtitle}</Text>

          <View style={styles.controls}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
              ))}
            </View>

            <Pressable style={styles.arrow} onPress={next}>
              <Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={26} color={colors.textOnBrand} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between", paddingHorizontal: 24 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
  logoWrap: { height: 48, width: 48, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff" },
  logo: { height: "100%", width: "100%" },
  skip: { color: "#fff", fontSize: 15, fontWeight: "800", opacity: 0.9 },
  bottom: { paddingBottom: 24 },
  title: { color: "#fff", fontSize: 34, fontWeight: "900", lineHeight: 40 },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 16, marginTop: 12, lineHeight: 22, maxWidth: 300 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { width: 26, backgroundColor: colors.brand },
  arrow: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
    shadowColor: colors.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
});
