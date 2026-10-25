import { DrinkType, MenuItem } from "@/api/types";

export interface Category {
  key: string;
  label: string;
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { key: "all", label: "All", emoji: "🍽️" },
  { key: "rice", label: "Rice", emoji: "🍚" },
  { key: "chicken", label: "Chicken", emoji: "🍗" },
  { key: "salad", label: "Salad", emoji: "🥗" },
  { key: "drinks", label: "Drinks", emoji: "🥤" },
];

// Whole-word matchers (\b avoids false hits like "steamed" → "tea").
// Order matters: rice dishes win over chicken (e.g. "Jollof Rice with Chicken").
const DRINKS = /\b(drinks?|juice|water|soda|malt|cola|coke|fanta|sprite|smoothie|coffee|tea|lemonade|milkshake|beverage)\b/;
const RICE = /\b(rice|jollof|waakye|banku|fufu|pilau|noodles?|spaghetti|pasta)\b/;
const CHICKEN = /\b(chicken|wings?|drumsticks?)\b/;
const SALAD = /\bsalad\b/;

function classify(text: string): string | null {
  const t = text.toLowerCase();
  if (DRINKS.test(t)) return "drinks";
  if (RICE.test(t)) return "rice";
  if (CHICKEN.test(t)) return "chicken";
  if (SALAD.test(t)) return "salad";
  return null;
}

/** The category of a dish. Uses the admin-set `category` from the backend when
 *  present; falls back to name/description keyword matching for any older item
 *  that predates the category field. */
export function categoryOf(item: MenuItem): string {
  if (item.category) return item.category;
  return classify(item.name) ?? classify(item.description ?? "") ?? "other";
}

export function inCategory(item: MenuItem, categoryKey: string): boolean {
  if (categoryKey === "all") return true;
  return categoryOf(item) === categoryKey;
}

export const DRINK_TABS: { key: DrinkType; label: string; emoji: string }[] = [
  { key: "soft", label: "Soft drinks", emoji: "🥤" },
  { key: "local", label: "Local drinks", emoji: "🍹" },
];

const LOCAL_DRINK = /\b(sobolo|bissap|hibiscus|ginger|watermelon|pineapple|asaana|pito|brukina|burkina|lamugin|tamarind|tigernut|coconut|fresh|local|homemade|zomi)\b/;

/** Soft or local. Uses the admin's choice; older drinks without one are guessed from the name. */
export function drinkTypeOf(item: MenuItem): DrinkType {
  if (item.drinkType) return item.drinkType;
  return LOCAL_DRINK.test(`${item.name} ${item.description ?? ""}`.toLowerCase()) ? "local" : "soft";
}

export function isDrink(item: MenuItem): boolean {
  return categoryOf(item) === "drinks";
}

export function foodEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/(sobolo|ginger|watermelon|asaana|pito|brukina|juice)/.test(n)) return "🍹";
  if (/(drink|water|soda|malt|cola)/.test(n)) return "🥤";
  if (n.includes("jollof") || n.includes("fried rice")) return "🍛";
  if (n.includes("rice")) return "🍚";
  if (n.includes("chicken")) return "🍗";
  return "🍲";
}
