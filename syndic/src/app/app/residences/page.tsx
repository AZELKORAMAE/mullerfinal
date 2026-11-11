import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { workspace } from "@/lib/data";
import { createResidence } from "@/app/actions";
import { Submit } from "@/components/submit";
import { Notice } from "@/components/notice";
import Link from "next/link";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const data = await workspace();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            <I18nText text="Résidences" />
          </h1>
          <p>
            <I18nText text="Un carnet d’adresses pour vos copropriétés." />
          </p>
        </div>
      </div>
      <Notice error={data.error} message={(await searchParams).message} />
      <div className="split">
        <section className="card">
          <h2>
            <I18nText text="Votre portefeuille" />
          </h2>
          {data.residences.length ? (
            data.residences.map((r) => (
              <article className="list-row" key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p>{r.address}</p>
                  <span className="badge">{r.city}</span>
                </div>
                <span className="small">
                  {data.units.filter((u) => u.residence_id === r.id).length}
                  <I18nText text={String(" ")} />
                  <I18nText text="lots" />
                </span>
              </article>
            ))
          ) : (
            <p className="empty">
              <I18nText text="Vos résidences apparaîtront ici après leur création." />
            </p>
          )}
        </section>
        <section className="card">
          <h2>
            <I18nText text="Ajouter une résidence" />
          </h2>
          {data.organizations.length ? (
            <form className="form" action={createResidence}>
              <label>
                <I18nText text="Organisation" />
                <select name="organization_id" required>
                  {data.organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <I18nText text="Nom" />
                <LocalizedInput
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Résidence Atlas"
                />
              </label>
              <label>
                <I18nText text="Adresse" />
                <LocalizedInput
                  name="address"
                  required
                  minLength={4}
                  maxLength={300}
                />
              </label>
              <label>
                <I18nText text="Ville" />
                <LocalizedInput
                  name="city"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <Submit>
                <I18nText text="Créer la résidence" />
              </Submit>
            </form>
          ) : (
            <p>
              <I18nText text="Commencez par" />
              <I18nText text={String(" ")} />
              <Link className="text-link" href="/app">
                <I18nText text="créer une organisation" />
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </>
  );
}
