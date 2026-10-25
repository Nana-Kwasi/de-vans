import { useEffect, useRef, useState } from "react";
import { RiderApi } from "./api";

export interface SharingState {
  /** "off" until enabled; "denied" if the browser/phone refused location. */
  status: "off" | "starting" | "on" | "denied" | "unsupported" | "error";
  lat?: number;
  lng?: number;
  accuracyM?: number;
  lastSentAt?: number;
}

const SEND_EVERY_MS = 10_000; // at most one report per 10 s…
const SEND_IF_MOVED_M = 25;   // …or sooner once the rider has moved this far
const MIN_GAP_MS = 3_000;     // and never faster than this (the API also rate-limits)

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Streams the rider's GPS position to the API while `enabled` (i.e. while online).
 *
 * Uses the browser's high-accuracy GPS. A web page only gets location while it is open,
 * so during an active delivery we also hold a screen wake lock to stop the phone from
 * sleeping and silently pausing the customer's live map.
 */
export function useLocationSharing(enabled: boolean, keepAwake: boolean): SharingState {
  const [state, setState] = useState<SharingState>({ status: "off" });
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "off" });
      return;
    }
    if (!("geolocation" in navigator)) {
      setState({ status: "unsupported" });
      return;
    }
    setState((s) => ({ ...s, status: "starting" }));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const now = Date.now();
        const prev = last.current;
        const due =
          !prev ||
          (now - prev.at >= MIN_GAP_MS &&
            (now - prev.at >= SEND_EVERY_MS || metersBetween(prev, { lat, lng }) >= SEND_IF_MOVED_M));
        setState((s) => ({ ...s, status: "on", lat, lng, accuracyM: accuracy }));
        if (due) {
          last.current = { lat, lng, at: now };
          RiderApi.location(lat, lng, accuracy)
            .then(() => setState((s) => ({ ...s, lastSentAt: Date.now() })))
            .catch(() => {});
        }
      },
      (err) => setState({ status: err.code === err.PERMISSION_DENIED ? "denied" : "error" }),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  // Keep the screen on during a delivery (re-acquired when the tab becomes visible again).
  useEffect(() => {
    if (!keepAwake || !("wakeLock" in navigator)) return;
    let lock: any = null;
    const acquire = async () => {
      try {
        lock = await (navigator as any).wakeLock.request("screen");
      } catch {
        /* not allowed (e.g. low battery) — tracking still works while the screen is on */
      }
    };
    acquire();
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.();
    };
  }, [keepAwake]);

  return state;
}
