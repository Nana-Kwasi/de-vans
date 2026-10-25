import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme/glass";

/** Light app canvas behind every screen. Pass `edges` to control safe-area sides;
 *  set `padded={false}` for edge-to-edge content (e.g. a hero image).
 *
 *  `avoidKeyboard` lifts the content above the on-screen keyboard. Android resizes the
 *  window on its own, so it only needs the view to be flexible; iOS does not, and needs
 *  explicit padding. Without this the keyboard sits on top of whatever you are typing
 *  into — which it did on every screen except sign-up. */
export function ScreenBackground({
  children,
  padded = true,
  avoidKeyboard = false,
  keyboardOffset = 0,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  avoidKeyboard?: boolean;
  keyboardOffset?: number;
  style?: ViewStyle;
}) {
  const content = (
    <SafeAreaView style={[styles.safe, padded && styles.padded, style]}>
      {children}
    </SafeAreaView>
  );

  return (
    <View style={styles.root}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardOffset}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  padded: { paddingHorizontal: 18 },
});
