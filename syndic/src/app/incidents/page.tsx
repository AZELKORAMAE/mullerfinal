import { intlLocale as getIntlLocale } from "@/lib/locale-server";
import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { signedIn } from "@/lib/access";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";
import { incidentAction } from "./actions";
type Unit = {
  id: string;
  label: string;
  residence: string;
  can_manage: boolean;
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const intlLocale = await getIntlLocale();

  const { db } = await signedIn();
  const [context, incidents] = await Promise.all([
    db.rpc("syndic_operations_context"),
    db
      .from("syndic_incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const units = (context.data?.units ?? []) as Unit[];
  const labels: Record<string, string> = {
    open: "Ouvert",
    in_progress: "En cours",
    resolved: "Résolu",
  };
  return (
    <div className="container">
      <header className="public-nav">
        <Brand />
        <Link href="/operations" className="button outline">
          <I18nText text="Gestion quotidienne" />
        </Link>
      </header>
      <main className="section">
        <span className="eyebrow">
          <I18nText text="Entretien et demandes" />
        </span>
        <h1>
          <I18nText text="Incidents" />
        </h1>
        <p>
          <I18nText text="Signalez un problème et suivez sa prise en charge." />
        </p>
        <Notice
          message={(await searchParams).message}
          error={Boolean(context.error || incidents.error)}
        />
        <div className="split">
          <section className="card">
            <h2>
              <I18nText text="Suivi des demandes" />
            </h2>
            {!incidents.data?.length && (
              <p>
                <I18nText text="Aucun incident déclaré." />
              </p>
            )}
            {incidents.data?.map((i) => {
              const unit = units.find((u) => u.id === i.unit_id);
              return (
                <details key={i.id}>
                  <summary>
                    {i.title} · <I18nText text={String(labels[i.status])} />
                    <I18nText text={String(" ")} />
                    <I18nText
                      text={String(i.priority === "urgent" ? "· Urgent" : "")}
                    />
                  </summary>
                  <p className="small">
                    {unit?.residence} · {unit?.label} ·
                    <I18nText text={String(" ")} />
                    {new Date(i.created_at).toLocaleDateString(intlLocale)}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{i.description}</p>
                  {i.resolution && (
                    <p>
                      <strong>
                        <I18nText text="Compte rendu :" />
                      </strong>{" "}
                      {i.resolution}
                    </p>
                  )}
                  {unit?.can_manage && (
                    <form action={incidentAction} className="form">
                      <LocalizedInput
                        type="hidden"
                        name="task"
                        value="update"
                      />
                      <LocalizedInput
                        type="hidden"
                        name="target"
                        value={i.id}
                      />
                      <label>
                        <I18nText text="Statut" />
                        <select name="status" defaultValue={i.status}>
                          {Object.entries(labels).map(([v, t]) => (
                            <option key={v} value={v}>
                              <I18nText text={String(t)} />
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <I18nText text="Compte rendu" />
                        <textarea
                          name="resolution"
                          defaultValue={i.resolution}
                          maxLength={5000}
                        />
                      </label>
                      <Submit>
                        <I18nText text="Mettre à jour" />
                      </Submit>
                    </form>
                  )}
                </details>
              );
            })}
          </section>
          <section className="card">
            <h2>
              <I18nText text="Déclarer un incident" />
            </h2>
            {units.length ? (
              <form action={incidentAction} className="form">
                <LocalizedInput type="hidden" name="task" value="report" />
                <label>
                  <I18nText text="Lot" />
                  <select name="target">
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.residence} · {u.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <I18nText text="Objet" />
                  <LocalizedInput
                    name="title"
                    required
                    minLength={3}
                    maxLength={160}
                  />
                </label>
                <label>
                  <I18nText text="Description" />
                  <textarea
                    name="description"
                    required
                    minLength={5}
                    maxLength={5000}
                    rows={5}
                  />
                </label>
                <label>
                  <I18nText text="Priorité" />
                  <select name="priority">
                    <option value="normal">
                      <I18nText text="Normale" />
                    </option>
                    <option value="urgent">
                      <I18nText text="Urgente" />
                    </option>
                  </select>
                </label>
                <Submit>
                  <I18nText text="Déclarer" />
                </Submit>
              </form>
            ) : (
              <p>
                <I18nText text="Votre syndic doit d’abord vous associer à un lot." />
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
