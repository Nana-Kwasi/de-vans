import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, Pressable } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PillButton } from "@/components/PillButton";
import { colors, radii } from "@/theme/glass";
import { Coords } from "@/hooks/useDeviceLocation";

/**
 * Full-screen map where the customer confirms (or drags) their delivery pin to the exact
 * door or gate. A GPS fix is often off by a house or a street; the customer knows where
 * they are standing, so letting them place the pin is what makes the rider's map exact.
 */
export function PinPickerModal({
  visible,
  initial,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initial: Coords | null;
  onCancel: () => void;
  onConfirm: (c: Coords) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState<Coords | null>(initial);

  useEffect(() => {
    if (visible) setPin(initial);
  }, [visible, initial?.latitude, initial?.longitude]);

  const region: Region | undefined = initial
    ? { latitude: initial.latitude, longitude: initial.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onCancel} hitSlop={12}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Confirm your delivery spot</Text>
          <View style={{ width: 26 }} />
        </View>

        {region ? (
          <MapView
            style={{ flex: 1 }}
            initialRegion={region}
            showsUserLocation
            onPress={(e) => setPin(e.nativeEvent.coordinate)}
          >
            {pin && (
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}
                pinColor={colors.brand}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.hint}>We couldn't get your location. Allow location access and try again.</Text>
          </View>
        )}

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.hint}>Drag the pin or tap the map to mark your exact gate or door. Your rider navigates straight to it.</Text>
          <PillButton title="Use this spot" disabled={!pin} onPress={() => pin && onConfirm(pin)} style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 12, backgroundColor: colors.surface },
  title: { fontSize: 17, fontWeight: "900", color: colors.textPrimary },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  footer: { padding: 18, backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  hint: { color: colors.textSecondary, fontWeight: "600", lineHeight: 20, textAlign: "center" },
});
