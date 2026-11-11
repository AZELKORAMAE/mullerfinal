export type Locale = "fr" | "ar" | "en";
export function validLocale(value: unknown): Locale {
  return value === "ar" || value === "en" ? value : "fr";
}
