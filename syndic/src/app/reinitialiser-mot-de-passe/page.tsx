import Link from "next/link";
import { resetPassword, resetPasswordWithCode } from "@/app/actions";
import { I18nText } from "@/components/i18n";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ message?: string }>;
}) {
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <h1><I18nText text="Réinitialiser le mot de passe" /></h1>
        <Notice message={(await searchParams).message} />
        <form action={resetPasswordWithCode} className="form">
          <label><I18nText text="Adresse e-mail" />
            <input name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>
          <label><I18nText text="Code à 6 chiffres" />
            <input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required />
          </label>
          <label><I18nText text="Nouveau mot de passe" />
            <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </label>
          <label><I18nText text="Confirmer le mot de passe" />
            <input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </label>
          <Submit><I18nText text="Enregistrer" /></Submit>
        </form>
        <details className="auth-divider">
          <summary><I18nText text="Demander un nouveau code" /></summary>
          <form action={resetPassword} className="form">
            <label><I18nText text="Adresse e-mail" />
              <input name="email" type="email" autoComplete="email" maxLength={254} required />
            </label>
            <Submit><I18nText text="Envoyer le code" /></Submit>
          </form>
        </details>
        <Link className="text-link" href="/connexion"><I18nText text="Se connecter" /></Link>
      </section>
    </main>
  );
}
