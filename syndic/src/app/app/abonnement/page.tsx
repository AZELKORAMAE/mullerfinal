import { intlLocale as getIntlLocale } from "@/lib/locale-server";
import { I18nText } from "@/components/i18n";
import { LocalizedInput } from "@/components/i18n-input";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";
import { signedIn } from "@/lib/access";
import { contact, daysLeft, planLabels } from "@/lib/plans";
import { submitPayment } from "./actions";
export const dynamic = "force-dynamic";
const statusLabels: Record<string, string> = {
  pending: "En attente de validation",
  approved: "Validé",
  rejected: "Refusé",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const intlLocale = await getIntlLocale();
  const { db, user } = await signedIn();
  const { data: membership } = await db
    .from("syndic_organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .limit(1);
  const orgId = membership?.[0]?.organization_id;
  const message = (await searchParams).message;
  if (!orgId)
    return (
      <>
        <h1>
          <I18nText text="Abonnement" />
        </h1>
        <Notice message={message} />
        <p>
          <I18nText text="Votre compte n’est associé à aucun syndic." />
        </p>
      </>
    );
  const [sub, billing, payments] = await Promise.all([
    db
      .from("syndic_subscription_records")
      .select("plan,status,ends_at")
      .eq("organization_id", orgId)
      .maybeSingle(),
    db
      .from("syndic_billing_settings")
      .select("account_holder,bank_name,rib,instructions")
      .maybeSingle(),
    db
      .from("syndic_subscription_payments")
      .select("id,plan,months,amount_cents,reference,status,admin_note,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const s = sub.data;
  const remaining = s ? daysLeft(s.ends_at) : 0;
  const active = s && remaining > 0 && ["active", "trialing"].includes(s.status);
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(intlLocale, { maximumFractionDigits: 2 }) +
    " DH";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <I18nText text="Espace syndic" />
          </span>
          <h1>
            <I18nText text="Mon abonnement" />
          </h1>
          <p>
            <I18nText text="Consultez votre plan, payez par virement bancaire et suivez vos paiements." />
          </p>
        </div>
      </div>
      <Notice
        message={message}
        error={Boolean(sub.error || billing.error || payments.error)}
      />
      <div className="stats">
        <div className="card">
          <p>
            <I18nText text="Plan actuel" />
          </p>
          <div className="stat-number">
            {s ? <I18nText text={planLabels[s.plan] ?? s.plan} /> : "—"}
          </div>
        </div>
        <div className="card">
          <p>
            <I18nText text="Jours restants" />
          </p>
          <div className="stat-number">{active ? remaining : 0}</div>
        </div>
        <div className="card">
          <p>
            <I18nText text="Fin de l’abonnement" />
          </p>
          <div className="stat-number" style={{ fontSize: 22 }}>
            {s ? new Date(s.ends_at).toLocaleDateString(intlLocale) : "—"}
          </div>
          <span className={"status-pill " + (active ? "ok" : "danger")}>
            <I18nText text={active ? "Actif" : "Expiré"} />
          </span>
        </div>
      </div>
      <div className="split">
        <section className="card">
          <h2>
            <I18nText text="Coordonnées bancaires" />
          </h2>
          {billing.data?.rib ? (
            <div className="list">
              <p>
                <I18nText text="Titulaire" /> :{" "}
                <strong>{billing.data.account_holder}</strong>
              </p>
              <p>
                <I18nText text="Banque" /> :{" "}
                <strong>{billing.data.bank_name}</strong>
              </p>
              <p>
                <I18nText text="RIB" /> :{" "}
                <strong style={{ overflowWrap: "anywhere" }}>
                  {billing.data.rib}
                </strong>
              </p>
              {billing.data.instructions && (
                <p className="small" style={{ whiteSpace: "pre-wrap" }}>
                  {billing.data.instructions}
                </p>
              )}
            </div>
          ) : (
            <p>
              <I18nText text="Le RIB sera bientôt disponible. Contactez-nous pour l’obtenir." />
            </p>
          )}
          <h3 style={{ marginTop: 20 }}>
            <I18nText text="Tarifs" />
          </h3>
          <p>
            <I18nText text="Standard : 30 DH par mois." />
          </p>
          <p>
            <I18nText text="Entreprise : prix sur devis." />{" "}
            <a className="text-link" href={contact.whatsapp}>
              <I18nText text="WhatsApp" />
            </a>{" "}
            · <a href={`tel:${contact.phoneIntl}`}>{contact.phone}</a> ·{" "}
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </p>
        </section>
        <section className="card">
          <h2>
            <I18nText text="Payer ou changer d’abonnement" />
          </h2>
          <form action={submitPayment} className="form">
            <label>
              <I18nText text="Plan" />
              <select
                name="plan"
                defaultValue={s?.plan === "entreprise" ? "entreprise" : "standard"}
              >
                <option value="standard">Standard · 30 DH / mois</option>
                <option value="entreprise">Entreprise · sur devis</option>
              </select>
            </label>
            <label>
              <I18nText text="Durée" />
              <select name="months" defaultValue="1">
                {[1, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>
                    {m} · {fmt(3000 * m)} (Standard)
                  </option>
                ))}
              </select>
            </label>
            <label>
              <I18nText text="Montant viré en DH (plan Entreprise uniquement)" />
              <LocalizedInput
                name="amount"
                type="number"
                min={1}
                step="0.01"
              />
            </label>
            <label>
              <I18nText text="Référence du virement (facultatif)" />
              <LocalizedInput name="reference" maxLength={160} />
            </label>
            <label>
              <I18nText text="Capture d’écran du virement" />
              <input
                name="proof"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                required
              />
              <span className="form-note">
                <I18nText text="PNG, JPG, WEBP ou PDF · 5 Mo maximum" />
              </span>
            </label>
            <Submit>
              <I18nText text="Envoyer le paiement" />
            </Submit>
            <p className="form-note">
              <I18nText text="Le changement de plan et la prolongation s’appliquent dès la validation du virement par notre équipe." />
            </p>
          </form>
        </section>
      </div>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>
          <I18nText text="Historique des paiements" />
        </h2>
        {payments.data?.length ? (
          payments.data.map((p) => (
            <div className="list-row" key={p.id}>
              <div>
                <strong>
                  <I18nText text={planLabels[p.plan] ?? p.plan} /> ·{" "}
                  {p.months} <I18nText text="mois" /> · {fmt(p.amount_cents)}
                </strong>
                <p className="small">
                  {new Date(p.created_at).toLocaleDateString(intlLocale)}
                  {p.reference ? " · " + p.reference : ""}
                  {p.admin_note ? " · " + p.admin_note : ""}
                </p>
              </div>
              <span
                className={
                  "status-pill " +
                  (p.status === "approved"
                    ? "ok"
                    : p.status === "rejected"
                      ? "danger"
                      : "")
                }
              >
                <I18nText text={statusLabels[p.status] ?? p.status} />
              </span>
            </div>
          ))
        ) : (
          <p>
            <I18nText text="Aucun paiement envoyé." />
          </p>
        )}
      </section>
    </>
  );
}
