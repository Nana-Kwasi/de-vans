/**
 * QuickChop design tokens (mobile).
 * Clean, light food-delivery look: soft grey canvas, white cards with soft
 * shadows, a warm orange brand accent, and a bottom tab bar.
 */
import { ViewStyle, TextStyle } from "react-native";

export const colors = {
  bg: "#F4F5F7",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F7F9", // input / subtle fill on white cards

  brand: "#F26A21",
  brandDark: "#E1560F",
  brandSoft: "#FEEDE2", // light orange tint (banners, chips, active bg)

  textPrimary: "#1B1D21",
  textSecondary: "#5B5E66",
  textMuted: "#9A9DA6",
  textOnBrand: "#FFFFFF",

  star: "#FF9F1C",
  hairline: "#ECEDF0",
  danger: "#E23744",
  success: "#1BA672",

  // --- legacy/compat aliases (kept so nothing that referenced the old glass
  //     theme breaks); prefer the tokens above in new code. ---
  gradient: ["#F4F5F7", "#F4F5F7"] as const,
  glassFill: "#FFFFFF",
  glassFillStrong: "#FFFFFF",
  glassBorder: "#ECEDF0",
  glassDarkOverlay: "rgba(0,0,0,0.5)",
  glassDarkBorder: "rgba(0,0,0,0.08)",
  textOnDark: "#FFFFFF",
  textOnDarkMuted: "rgba(255,255,255,0.86)",
  priceAccent: "#F26A21",
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const spacing = (n: number) => n * 8;

/** Soft, neutral shadow for white cards. */
export const shadow: ViewStyle = {
  shadowColor: "#0B0B0F",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.06,
  shadowRadius: 22,
  elevation: 3,
};

/** Base style for a white surface card. */
export const card: ViewStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.lg,
  ...shadow,
};
/** Legacy alias. */
export const glassCard = card;

/** Shared text input on white cards. */
export const input: TextStyle = {
  backgroundColor: colors.surfaceAlt,
  borderRadius: radii.md,
  borderWidth: 1,
  borderColor: colors.hairline,
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 16,
  color: colors.textPrimary,
};

export const heading: TextStyle = {
  color: colors.textPrimary,
  fontSize: 22,
  fontWeight: "800",
};

export const subheading: TextStyle = {
  color: colors.textMuted,
  fontSize: 14,
  fontWeight: "500",
};

export const money = (amount: number | string) =>
  `GHS ${Number(amount).toFixed(2)}`;
