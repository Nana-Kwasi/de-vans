import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { Coords } from "./useDeviceLocation";

export interface PreciseLocation {
  coords: Coords | null;
  /** Radius (metres) the fix is good to — smaller is better. */
  accuracyM: number | null;
  status: "idle" | "locating" | "done" | "denied" | "error";
  /** Start (or restart) a fresh high-accuracy fix. */
  refresh: () => void;
}

const GOOD_ENOUGH_M = 15;  // stop early once the fix is this tight
const MAX_WAIT_MS = 15_000; // otherwise keep the best fix found in this time

/**
 * A delivery-grade location fix.
 *
 * The home screen's location is Balanced accuracy (often ±100 m or worse) — fine for a
 * neighbourhood label, not for a rider trying to find a gate. This watches the GPS at
 * navigation accuracy and keeps the best reading until it is within ~15 m or 15 s pass.
 */
export function usePreciseLocation(enabled: boolean): PreciseLocation {
  const [state, setState] = useState<Omit<PreciseLocation, "refresh">>({ coords: null, accuracyM: null, status: "idle" });
  const sub = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [run, setRun] = useState(0);

  const stop = () => {
    sub.current?.remove();
    sub.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, status: "locating" }));
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setState((s) => ({ ...s, status: "denied" }));
        return;
      }
      let best: Location.LocationObject | null = null;
      try {
        sub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
          (pos) => {
            const acc = pos.coords.accuracy ?? 9999;
            if (!best || acc < (best.coords.accuracy ?? 9999)) {
              best = pos;
              setState({
                coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
                accuracyM: acc,
                status: acc <= GOOD_ENOUGH_M ? "done" : "locating",
              });
            }
            if (acc <= GOOD_ENOUGH_M) stop();
          }
        );
        timer.current = setTimeout(() => {
          stop();
          setState((s) => ({ ...s, status: best ? "done" : "error" }));
        }, MAX_WAIT_MS);
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, run]);

  const refresh = useCallback(() => setRun((n) => n + 1), []);
  return { ...state, refresh };
}
