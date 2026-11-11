import Link from "next/link";
import { redirect } from "next/navigation";
import { I18nText } from "@/components/i18n";
import { LocalizedInput } from "@/components/i18n-input";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";
import { signedIn } from "@/lib/access";
import { signOut, requestSyndicAccount } from "@/app/actions";
import { contact, plans } from "@/lib/plans";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db, user } = await signedIn();
  const { data: status } = await db.rpc("syndic_my_status");
  if (status?.member) redirect("/app");
  const { data: request } = await db
    .from("syndic_account_requests")
    .select("organization_name,status,created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <Brand />
        <Notice message={(await searchParams).message} />
        {request?.status === "pending" && (
          <>
            <span className="eyebrow">
              <I18nText text="Compte syndic" />
            </span>
            <h1>
              <I18nText text="Votre compte attend l’approbation" />
            </h1>
            <p>
              <I18nText text="Notre équipe vérifie votre demande pour" />
              <strong>{request.organization_name}</strong>.
              <I18nText text="Vous pourrez accéder à votre espace syndic dès sa validation." />
            </p>
          </>
        )}
        {request?.status === "rejected" && (
          <>
            <h1>
              <I18nText text="Demande non validée" />
            </h1>
            <p>
              <I18nText text="Votre demande de compte syndic n’a pas été acceptée. Contactez-nous ou envoyez une nouvelle demande." />
            </p>
          </>
        )}
        {(!request || request.status === "rejected") && (
          <form action={requestSyndicAccount} className="form">
            <h2>
              <I18nText text="Demander un compte syndic" />
            </h2>
            <label>
              <I18nText text="Nom du syndic / de la société" />
              <LocalizedInput
                name="organization"
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label>
              <I18nText text="Téléphone" />
              <LocalizedInput
                name="phone"
                type="tel"
                required
                maxLength={24}
                defaultValue={
                  typeof user.user_metadata?.phone === "string"
                    ? user.user_metadata.phone
                    : ""
                }
              />
            </label>
            <label>
              <I18nText text="Plan souhaité" />
              <select name="plan" defaultValue="essai">
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · {plan.price}
                  </option>
                ))}
              </select>
            </label>
            <Submit>
              <I18nText text="Envoyer la demande" />
            </Submit>
          </form>
        )}
        <p className="small" style={{ marginTop: 24 }}>
          <I18nText text="Besoin d’aide ?" />
          <a className="text-link" href={contact.whatsapp}>
            <I18nText text="WhatsApp" />
          </a>
          · <a href={`tel:${contact.phoneIntl}`}>{contact.phone}</a> ·{" "}
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        </p>
        <div className="row-actions" style={{ marginTop: 16 }}>
          <Link href="/resident" className="button outline">
            <I18nText text="Mon espace résident" />
          </Link>
          <form action={signOut}>
            <button className="text-link">
              <I18nText text="Déconnexion" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
