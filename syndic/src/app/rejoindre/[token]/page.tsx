import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { z } from "zod";
import Link from "next/link";
import { provisionClient } from "@/lib/provision";
import { Brand } from "@/components/brand";
import { Submit } from "@/components/submit";
import { Notice } from "@/components/notice";
import { joinResidence, joinWithAccount } from "./actions";
import { supabase } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { token } = await params;
  const session = await supabase();
  const {
    data: { user },
  } = await session.auth.getUser();
  let residence = "";
  let manager = "";
  try {
    if (z.uuid().safeParse(token).success) {
      const db = provisionClient();
      const { data: link } = await db
        .from("syndic_join_links")
        .select("unit_id")
        .eq("id", token)
        .is("used_by", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();
      if (link) {
        const { data: unit } = await db
          .from("syndic_units")
          .select("residence_id")
          .eq("id", link.unit_id)
          .single();
        if (unit) {
          const { data: r } = await db
            .from("syndic_residences")
            .select("name,organization_id")
            .eq("id", unit.residence_id)
            .single();
          if (r) {
            const { data: o } = await db
              .from("syndic_organizations")
              .select("name")
              .eq("id", r.organization_id)
              .single();
            residence = r.name;
            manager = o?.name ?? "Votre syndic";
          }
        }
      }
    }
  } catch {}
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <Brand />
        {residence ? (
          <>
            <span className="eyebrow">
              <I18nText text="Bienvenue chez vous" />
            </span>
            <h1>
              <I18nText text="Bonjour 👋" />
            </h1>
            <p>
              <I18nText text="Vous êtes invité à rejoindre" />
              <strong>{residence}</strong>
              <I18nText text=", gérée par" />
              <strong>{manager}</strong>.
            </p>
            <Notice message={(await searchParams).message} />
            <p className="form-note">
              <I18nText text="Votre syndic validera votre demande avant l’ouverture de votre accès." />
            </p>
            {user ? (
              <form action={joinWithAccount} className="form">
                <input type="hidden" name="token" value={token} />
                <p>
                  <I18nText text="Connecté en tant que" />
                  <strong>{user.email}</strong>
                </p>
                <Submit>
                  <I18nText text="Rejoindre avec mon compte" />
                </Submit>
              </form>
            ) : (
            <>
            <div className="notice">
              <I18nText text="Vous avez déjà un compte ?" />
              <Link
                className="text-link"
                href={`/connexion?next=${encodeURIComponent("/rejoindre/" + token)}`}
              >
                <I18nText text="Se connecter pour rejoindre" />
              </Link>
            </div>
            <form action={joinResidence} className="form">
              <LocalizedInput type="hidden" name="token" value={token} />
              <label>
                <I18nText text="Prénom" />
                <LocalizedInput
                  name="first_name"
                  autoComplete="given-name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label>
                <I18nText text="Nom" />
                <LocalizedInput
                  name="last_name"
                  autoComplete="family-name"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label>
                <I18nText text="Pseudo" />
                <LocalizedInput
                  name="nickname"
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={40}
                />
              </label>
              <label>
                <I18nText text="Téléphone" />
                <LocalizedInput
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={24}
                />
              </label>
              <label>
                <I18nText text="E-mail de connexion" />
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
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                />
                <span className="form-note">
                  <I18nText text="12 caractères minimum" />
                </span>
              </label>
              <Submit>
                <I18nText text="Rejoindre ma résidence" />
              </Submit>
            </form>
            </>
            )}
          </>
        ) : (
          <>
            <h1>
              <I18nText text="Invitation indisponible" />
            </h1>
            <p>
              <I18nText text="Ce lien a expiré, a déjà été utilisé ou a été révoqué. Demandez un nouveau lien à votre syndic." />
            </p>
            <Link href="/connexion" className="button primary">
              <I18nText text="Se connecter" />
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
