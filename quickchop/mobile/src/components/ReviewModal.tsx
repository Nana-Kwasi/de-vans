import React, { useState } from "react";
import { Modal, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PillButton } from "@/components/PillButton";
import { colors, radii } from "@/theme/glass";

/** Optional review prompt shown after an order is delivered / picked up. */
export function ReviewModal({
  visible,
  orderNumber,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  orderNumber?: string;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const submit = () => {
    onSubmit(rating, comment.trim());
    setComment("");
    setRating(5);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Pressable style={styles.close} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>

          <Text style={styles.emoji}>😋</Text>
          <Text style={styles.title}>How was your order?</Text>
          {!!orderNumber && <Text style={styles.subtitle}>Order {orderNumber}</Text>}

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Ionicons name={n <= rating ? "star" : "star-outline"} size={34} color={colors.star} />
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Tell us more (optional)…"
            placeholderTextColor={colors.textMuted}
          />

          <PillButton title="Submit review" onPress={submit} style={{ marginTop: 16 }} />
          <Pressable onPress={onClose} style={styles.later}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 34, alignItems: "center" },
  close: { position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 48, marginTop: 8 },
  title: { fontSize: 20, fontWeight: "900", color: colors.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  stars: { flexDirection: "row", gap: 10, marginTop: 18, marginBottom: 20 },
  input: {
    alignSelf: "stretch", backgroundColor: colors.surfaceAlt, borderRadius: radii.md, borderWidth: 1, borderColor: colors.hairline,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.textPrimary, minHeight: 90, textAlignVertical: "top",
  },
  later: { marginTop: 14, padding: 6 },
  laterText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
});
