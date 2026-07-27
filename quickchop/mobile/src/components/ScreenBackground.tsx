import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/glass";

/** Light app canvas behind every screen. Pass `edges` to control safe-area sides;
 *  set `padded={false}` for edge-to-edge content (e.g. a hero image). */
export function ScreenBackground({
  children,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={styles.root}>
      <SafeAreaView style={[styles.safe, padded && styles.padded, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  padded: { paddingHorizontal: 18 },
});
