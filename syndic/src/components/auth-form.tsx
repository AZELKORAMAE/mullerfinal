import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Submit } from "@/components/submit";
import { signIn, signUp, resetPassword } from "@/app/actions";
export function AuthForm({
  signup = false,
  message,
  next,
}: {
  signup?: boolean;
  message?: string;
  next?: string;
}) {
  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <Brand />
        <h1>
          <I18nText
            text={String(
              signup ? "Créer votre espace" : "Heureux de vous retrouver",
            )}
          />
        </h1>
        <p>
          <I18nText
            text={String(
              signup
                ? "Commencez par votre compte, puis créez votre première résidence."
                : "Connectez-vous pour retrouver vos résidences.",
            )}
          />
        </p>
        {message && (
          <div className="notice" role="status">
            <I18nText text={message} />
          </div>
        )}
        <form action={signup ? signUp : signIn} className="form">
          {next && <input type="hidden" name="next" value={next} />}
          <label>
            <I18nText text="Adresse e-mail" />
            <LocalizedInput
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            <I18nText text="Mot de passe" />
            <LocalizedInput
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 12 : 1}
              maxLength={128}
            />
          </label>
          {signup && (
            <p className="form-note">
              <I18nText text="12 caractères minimum. Un e-mail de confirmation vous sera envoyé." />
            </p>
          )}
          <Submit>
            <I18nText
              text={String(signup ? "Créer mon compte" : "Se connecter")}
            />
          </Submit>
        </form>
        <p className="small" style={{ marginTop: 24 }}>
          <I18nText text="Pas encore de compte ?" />
          <Link
            className="text-link"
            href={
              signup
                ? "/connexion"
                : next
                  ? `/inscription?next=${encodeURIComponent(next)}`
                  : "/inscription"
            }
          >
            <I18nText
              text={String(signup ? "Se connecter" : "Créer un compte")}
            />
          </Link>
        </p>
        {!signup && (
          <details className="auth-divider">
            <summary>
              <I18nText text="Mot de passe oublié ?" />
            </summary>
            <form
              action={resetPassword}
              className="form"
              style={{ marginTop: 16 }}
            >
              <label>
                <I18nText text="Votre e-mail" />
                <LocalizedInput name="email" type="email" required />
              </label>
              <Submit>
                <I18nText text="Envoyer le code" />
              </Submit>
            </form>
            <Link className="text-link" href="/reinitialiser-mot-de-passe">
              <I18nText text="J’ai déjà un code" />
            </Link>
          </details>
        )}
      </div>
    </main>
  );
}
