import { intlLocale as getIntlLocale } from "@/lib/locale-server";
import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { platformAdmin } from "@/lib/access";
import { Submit } from "@/components/submit";
import { Notice } from "@/components/notice";
import { setSubscription, decideAccount, reviewPayment, saveBilling } from "./actions";
import { provisionClient } from "@/lib/provision";
import { planLabels } from "@/lib/plans";
import { provisionSyndic } from "./provision";
const statuses: Record<string, string> = {
  trialing: "Essai",
  active: "Actif",
  past_due: "À régulariser",
  canceled: "Résilié",
  expired: "Expiré",
  suspended: "Suspendu",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const intlLocale = await getIntlLocale();

  const { db } = await platformAdmin();
  const [orgs, subs, history, requests, payments, billing] = await Promise.all([
    db.rpc("syndic_admin_organizations"),
    db.from("syndic_subscription_records").select("*"),
    db
      .from("syndic_subscription_history")
      .select("id,organization_id,new_value,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("syndic_account_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at"),
    db
      .from("syndic_subscription_payments")
      .select("*")
      .eq("status", "pending")
      .order("created_at"),
    db.from("syndic_billing_settings").select("*").maybeSingle(),
  ]);
  const proofs: Record<string, string> = {};
  if (payments.data?.length) {
    try {
      const { data } = await provisionClient()
        .storage.from("syndic-payment-proofs")
        .createSignedUrls(
          payments.data.map((p) => p.proof_path),
          3600,
        );
      data?.forEach((d) => {
        if (d.path && d.signedUrl) proofs[d.path] = d.signedUrl;
      });
    } catch {}
  }
  const organizations = (orgs.data ?? []) as {
    id: string;
    name: string;
    created_at: string;
  }[];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <I18nText text="Gestion de la plateforme" />
          </span>
          <h1>
            <I18nText text="Administration" />
          </h1>
          <p>
            <I18nText text="Organisations clientes et suivi des abonnements." />
          </p>
        </div>
        <span className="badge">
          <I18nText text="Accès réservé" />
        </span>
      </div>
      <Notice
        message={(await searchParams).message}
        error={Boolean(orgs.error || subs.error || history.error)}
      />
      {(requests.data?.length || payments.data?.length) ? (
        <div role="alert" className="notice">
          🔔 <I18nText text="À traiter :" />
          {requests.data?.length ?? 0} <I18nText text="compte(s) syndic" /> ·{" "}
          {payments.data?.length ?? 0} <I18nText text="virement(s)" />
        </div>
      ) : null}
      <section className="card" style={{ marginBottom: 24 }}>
        <h2>
          <I18nText text="Comptes syndic en attente d’approbation" />
        </h2>
        {!requests.data?.length && (
          <p>
            <I18nText text="Aucune demande en attente." />
          </p>
        )}
        {requests.data?.map((r) => (
          <article key={r.user_id} className="list-row">
            <div>
              <strong>{r.organization_name}</strong>
              <p className="small">
                {r.full_name} · {r.email} · {r.phone}
              </p>
              <p className="small">
                <I18nText text="Plan souhaité" /> :{" "}
                <I18nText text={planLabels[r.desired_plan] ?? r.desired_plan} /> ·{" "}
                {new Date(r.created_at).toLocaleDateString(intlLocale)}
              </p>
            </div>
            <div className="row-actions">
              <form action={decideAccount}>
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="decision" value="approve" />
                <Submit>
                  <I18nText text="Approuver" />
                </Submit>
              </form>
              <form action={decideAccount}>
                <input type="hidden" name="user_id" value={r.user_id} />
                <input type="hidden" name="decision" value="reject" />
                <Submit>
                  <I18nText text="Refuser" />
                </Submit>
              </form>
            </div>
          </article>
        ))}
      </section>
      <section className="card" style={{ marginBottom: 24 }}>
        <h2>
          <I18nText text="Virements à vérifier" />
        </h2>
        {!payments.data?.length && (
          <p>
            <I18nText text="Aucun paiement en attente." />
          </p>
        )}
        {payments.data?.map((p) => {
          const url = proofs[p.proof_path];
          return (
            <article key={p.id} className="section-note" style={{ marginBottom: 18 }}>
              <strong>
                {organizations.find((o) => o.id === p.organization_id)?.name ??
                  "Organisation"}
              </strong>
              <p className="small">
                <I18nText text={planLabels[p.plan] ?? p.plan} /> · {p.months}{" "}
                <I18nText text="mois" /> · {(p.amount_cents / 100).toLocaleString(intlLocale)} DH
                {p.reference ? " · " + p.reference : ""} ·{" "}
                {new Date(p.created_at).toLocaleString(intlLocale)}
              </p>
              {url ? (
                p.proof_path.endsWith(".pdf") ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-link">
                    <I18nText text="Voir la capture du virement" />
                  </a>
                ) : (
                  <a href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Virement" className="proof-preview" />
                  </a>
                )
              ) : (
                <p className="small">
                  <I18nText text="Capture indisponible (vérifiez SUPABASE_SECRET_KEY)." />
                </p>
              )}
              <div className="row-actions" style={{ marginTop: 12 }}>
                <form action={reviewPayment}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <Submit>
                    <I18nText text="Valider et prolonger" />
                  </Submit>
                </form>
                <form action={reviewPayment} className="row-actions">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <LocalizedInput name="note" maxLength={500} placeholder="Motif du refus (facultatif)" />
                  <Submit>
                    <I18nText text="Refuser" />
                  </Submit>
                </form>
              </div>
            </article>
          );
        })}
      </section>
      <div className="stats">
        <div className="card">
          <p>
            <I18nText text="Organisations" />
          </p>
          <div className="stat-number">{organizations.length}</div>
        </div>
        <div className="card">
          <p>
            <I18nText text="Abonnements actifs" />
          </p>
          <div className="stat-number">
            {subs.data?.filter(
              (s) => s.status === "active" && new Date(s.ends_at) > new Date(),
            ).length ?? 0}
          </div>
        </div>
        <div className="card">
          <p>
            <I18nText text="À configurer" />
          </p>
          <div className="stat-number">
            {
              organizations.filter(
                (o) => !subs.data?.some((s) => s.organization_id === o.id),
              ).length
            }
          </div>
        </div>
      </div>
      <section className="card">
        <h2>
          <I18nText text="Créer un compte syndic" />
        </h2>
        {!process.env.SUPABASE_SECRET_KEY && (
          <div role="alert" className="notice">
            <I18nText text="La création des comptes nécessite la variable serveur SUPABASE_SECRET_KEY dans Vercel, puis un redéploiement. Les comptes existants continuent de fonctionner." />
          </div>
        )}
        <p>
          <I18nText text="Le compte est activé immédiatement sans e-mail de confirmation." />
        </p>
        <form action={provisionSyndic} className="form">
          <label>
            <I18nText text="Organisation" />
            <LocalizedInput
              name="organization"
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label>
            <I18nText text="E-mail de connexion" />
            <LocalizedInput name="email" type="email" required />
          </label>
          <label>
            <I18nText text="Mot de passe initial" />
            <LocalizedInput
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <Submit>
            <I18nText text="Créer le compte syndic" />
          </Submit>
        </form>
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>
          <I18nText text="Abonnements des syndics" />
        </h2>
        <p>
          <I18nText text="Suivi manuel. Chaque modification exige un motif et conserve un historique. Aucun encaissement automatique n’est effectué." />
        </p>
        {organizations.length === 0 && (
          <p className="empty">
            <I18nText text="Aucune organisation cliente pour le moment." />
          </p>
        )}
        <div className="list">
          {organizations.map((o) => {
            const sub = subs.data?.find((s) => s.organization_id === o.id);
            return (
              <details key={o.id}>
                <summary>
                  {o.name} —<I18nText text={String(" ")} />
                  {sub && (
                    <>
                      <I18nText text={planLabels[sub.plan] ?? sub.plan} /> ·{" "}
                    </>
                  )}
                  <I18nText text={sub
                    ? new Date(sub.ends_at) <= new Date() &&
                      ["active", "trialing"].includes(sub.status)
                      ? "Expiré"
                      : statuses[sub.status]
                    : "Non configuré"} />
                </summary>
                <form
                  action={setSubscription}
                  className="form"
                  style={{ marginTop: 18 }}
                >
                  <LocalizedInput
                    type="hidden"
                    name="organization_id"
                    value={o.id}
                  />
                  <label>
                    <I18nText text="Offre" />
                    <select name="plan" defaultValue={sub?.plan ?? "essai"}>
                      <option value="essai">
                        <I18nText text="Essai gratuit" />
                      </option>
                      <option value="standard">
                        <I18nText text="Standard" />
                      </option>
                      <option value="entreprise">
                        <I18nText text="Entreprise" />
                      </option>
                    </select>
                  </label>
                  <label>
                    <I18nText text="Statut" />
                    <select
                      name="status"
                      defaultValue={sub?.status ?? "trialing"}
                    >
                      {Object.entries(statuses).map(([value, label]) => (
                        <option key={value} value={value}>
                          <I18nText text={String(label)} />
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <I18nText text="Fin de période (fin de journée UTC)" />
                    <LocalizedInput
                      type="date"
                      name="end_date"
                      defaultValue={sub?.ends_at?.slice(0, 10)}
                      required
                    />
                  </label>
                  <label>
                    <I18nText text="Motif / référence de validation" />
                    <LocalizedInput
                      name="reason"
                      required
                      minLength={5}
                      maxLength={500}
                      placeholder="Référence de règlement vérifié ou décision commerciale"
                    />
                  </label>
                  <Submit>
                    <I18nText text="Enregistrer l’abonnement" />
                  </Submit>
                </form>
              </details>
            );
          })}
        </div>
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>
          <I18nText text="Coordonnées bancaires (RIB)" />
        </h2>
        <p>
          <I18nText text="Affichées aux syndics dans leur page Abonnement." />
        </p>
        <form action={saveBilling} className="form">
          <label>
            <I18nText text="Titulaire" />
            <LocalizedInput
              name="account_holder"
              maxLength={160}
              defaultValue={billing.data?.account_holder ?? ""}
            />
          </label>
          <label>
            <I18nText text="Banque" />
            <LocalizedInput
              name="bank_name"
              maxLength={160}
              defaultValue={billing.data?.bank_name ?? ""}
            />
          </label>
          <label>
            <I18nText text="RIB" />
            <LocalizedInput
              name="rib"
              maxLength={64}
              defaultValue={billing.data?.rib ?? ""}
            />
          </label>
          <label>
            <I18nText text="Instructions" />
            <textarea
              name="instructions"
              maxLength={1000}
              rows={3}
              defaultValue={billing.data?.instructions ?? ""}
            />
          </label>
          <Submit>
            <I18nText text="Enregistrer le RIB" />
          </Submit>
        </form>
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>
          <I18nText text="Dernières modifications" />
        </h2>
        {history.data?.length ? (
          history.data.map((h) => (
            <div key={h.id} className="list-row">
              <div>
                <strong>
                  {organizations.find((o) => o.id === h.organization_id)
                    ?.name ?? "Organisation"}
                </strong>
                <p>
                  <I18nText text={String(statuses[h.new_value.status])} /> ·{" "}
                  {h.new_value.note}
                </p>
              </div>
              <span className="small">
                {new Date(h.created_at).toLocaleDateString(intlLocale)}
              </span>
            </div>
          ))
        ) : (
          <p>
            <I18nText text="Aucune modification enregistrée." />
          </p>
        )}
      </section>
      <p className="small" style={{ marginTop: 20 }}>
        <I18nText text="Les paiements se font par virement bancaire : chaque capture est vérifiée manuellement avant prolongation." />
      </p>
    </>
  );
}
