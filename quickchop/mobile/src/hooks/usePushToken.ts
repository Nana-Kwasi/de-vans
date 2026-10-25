import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { CustomerApi } from "@/api/endpoints";
import { useAuth } from "@/store/auth";

Notifications.setNotificationHandler({
  // SDK 54 replaced the single `shouldShowAlert` with two flags: `shouldShowBanner`
  // (the heads-up banner while the app is open) and `shouldShowList` (the entry kept
  // in the notification centre). The old flag meant both, so both are true here.
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests notification permission, gets the device push token, and registers it
 * with the backend so order-status pushes (via FCM) can reach this device.
 * Call once from a screen shown after login (e.g. Home).
 */
export function usePushToken() {
  const session = useAuth((s) => s.session);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      try {
        const token = (await Notifications.getDevicePushTokenAsync()).data;
        await CustomerApi.registerFcmToken(String(token));
      } catch {
        // Push token registration is best-effort.
      }
    })();
  }, [session]);
}
