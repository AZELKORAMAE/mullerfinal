"use client";
import { I18nText } from "@/components/i18n";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell">
      <div className="card">
        <h1>
          <I18nText text="Une interruption temporaire" />
        </h1>
        <p>
          <I18nText text="Vérifiez la configuration Supabase et réessayez." />
        </p>
        <button className="button primary" onClick={reset}>
          <I18nText text="Réessayer" />
        </button>
      </div>
    </main>
  );
}
