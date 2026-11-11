import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { Building2, Grid2X2, Users } from "lucide-react";
import { workspace } from "@/lib/data";

import { Notice } from "@/components/notice";
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
          <span className="eyebrow">
            <I18nText text="Votre espace de gestion" />
          </span>
          <h1>
            <I18nText text="Vue d’ensemble" />
          </h1>
          <p>
            <I18nText text="Vos copropriétés, au même endroit." />
          </p>
        </div>
        <Link href="/app/residences" className="button primary">
          <I18nText text="Ajouter une résidence" />
        </Link>
      </div>
      <Notice error={data.error} message={(await searchParams).message} />
      <div className="stats">
        {[
          [Users, "Organisations", data.organizations.length],
          [Building2, "Résidences", data.residences.length],
          [Grid2X2, "Lots", data.units.length],
        ].map(([Icon, label, count]) => {
          const I = Icon as typeof Users;
          return (
            <div className="card" key={String(label)}>
              <I size={22} />
              <p style={{ margin: "12px 0 0" }}>
                <I18nText text={String(String(label))} />
              </p>
              <div className="stat-number">
                {data.error ? "—" : String(count)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="split">
        <section className="card">
          <h2>
            <I18nText text="Vos résidences" />
          </h2>
          <p>
            <I18nText text="Retrouvez les copropriétés de vos organisations." />
          </p>
          {data.residences.length ? (
            data.residences.map((r) => (
              <div className="list-row" key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p className="small">
                    {r.city} · {r.address}
                  </p>
                </div>
                <Link className="text-link small" href="/app/lots">
                  <I18nText text="Voir les lots" />
                </Link>
              </div>
            ))
          ) : (
            <div className="empty">
              <I18nText text="Aucune résidence pour le moment. Votre organisation doit être attribuée par l’administration ; ensuite, ajoutez votre première résidence." />
            </div>
          )}
        </section>
        <section className="card">
          <h2>
            <I18nText text="Actions rapides" />
          </h2>
          <p>
            <I18nText text="Votre organisation est attribuée par l’administration." />
          </p>
          <div className="list">
            <Link href="/app/residences" className="button outline">
              <I18nText text="Ajouter une résidence" />
            </Link>
            <Link href="/app/communaute" className="button outline">
              <I18nText text="Gérer les habitants" />
            </Link>
            <Link href="/operations" className="button outline">
              <I18nText text="Finances et messages" />
            </Link>
            <Link href="/incidents" className="button outline">
              <I18nText text="Suivre les incidents" />
            </Link>
          </div>
        </section>
      </div>
      <div className="section-note">
        <strong>
          <I18nText text="Votre parcours de démarrage" />
        </strong>
        <p style={{ margin: "8px 0 0" }}>
          <I18nText text="1. Recevoir votre accès → 2. Ajouter une résidence → 3. Enregistrer les lots" />
        </p>
      </div>
    </>
  );
}
