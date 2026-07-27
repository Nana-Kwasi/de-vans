import { useEffect, useState } from "react";
import * as Location from "expo-location";

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface DeviceLocation {
  label: string;
  coords: Coords | null;
  loading: boolean;
  denied: boolean;
}

/** Detects the device's location, reverse-geocodes a short "Area, City" label
 *  for the header, and exposes the raw coords (used for delivery ETA). */
export function useDeviceLocation(): DeviceLocation {
  const [state, setState] = useState<DeviceLocation>({
    label: "Detecting location…",
    coords: null,
    loading: true,
    denied: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (active) setState({ label: "Set your location", coords: null, loading: false, denied: true });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        const [place] = await Location.reverseGeocodeAsync(coords);
        if (!active) return;
        let label = "Your location";
        if (place) {
          const primary = place.name || place.street || place.district || place.city || place.subregion;
          const secondary = place.city || place.region || place.country;
          label = [primary, secondary].filter(Boolean).slice(0, 2).join(", ") || label;
        }
        setState({ label, coords, loading: false, denied: false });
      } catch {
        if (active) setState({ label: "Set your location", coords: null, loading: false, denied: false });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return state;
}
