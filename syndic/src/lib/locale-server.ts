import { cookies } from "next/headers";
import { validLocale } from "./locale";
export async function currentLocale() {
  return validLocale((await cookies()).get("syndic_locale")?.value);
}
export async function intlLocale() {
  const locale = await currentLocale();
  return locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-MA";
}
