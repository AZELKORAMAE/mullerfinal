import { I18nText } from "@/components/i18n";
import Link from "next/link";
export default function Page() {
  return (
    <main className="auth-shell">
      <section className="card">
        <h1>
          <I18nText text="Accès réservé" />
        </h1>
        <p>
          <I18nText text="Ce compte ne dispose pas des droits d’administration de la plateforme." />
        </p>
        <Link href="/app" className="button primary">
          <I18nText text="Revenir à mon espace" />
        </Link>
      </section>
    </main>
  );
}
