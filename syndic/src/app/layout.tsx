import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { validLocale } from "@/lib/locale";
import { LanguageProvider, LanguagePicker } from "@/components/i18n";
export const metadata: Metadata = {
  title: {
    default: "SyndiConnect — Votre copropriété, en toute transparence",
    template: "%s · SyndiConnect",
  },
  description:
    "Gestion des copropriétés au Maroc. Organisez vos résidences et vos lots dans un espace sécurisé.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = validLocale((await cookies()).get("syndic_locale")?.value);
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <LanguageProvider locale={locale}>
          <div className="global-language">
            <LanguagePicker />
          </div>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
