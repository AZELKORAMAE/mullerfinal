import { intlLocale as getIntlLocale } from "@/lib/locale-server";
import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { workspace } from "@/lib/data";
import { createUnit } from "@/app/actions";
import { Submit } from "@/components/submit";
import { Notice } from "@/components/notice";
import Link from "next/link";
const kinds: Record<string, string> = {
  apartment: "Appartement",
  shop: "Commerce",
  parking: "Parking",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const intlLocale = await getIntlLocale();

  const data = await workspace();
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            <I18nText text="Lots" />
          </h1>
          <p>
            <I18nText text="Appartements, commerces et parkings de vos résidences." />
          </p>
        </div>
      </div>
      <Notice error={data.error} message={(await searchParams).message} />
      <div className="split">
        <section className="card">
          <h2>
            <I18nText text="Registre des lots" />
          </h2>
          {data.units.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <I18nText text="Lot" />
                    </th>
                    <th>
                      <I18nText text="Résidence" />
                    </th>
                    <th>
                      <I18nText text="Type" />
                    </th>
                    <th>
                      <I18nText text="Quote-part" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.units.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.label}</strong>
                      </td>
                      <td>
                        {
                          data.residences.find((r) => r.id === u.residence_id)
                            ?.name
                        }
                      </td>
                      <td>
                        <I18nText text={String(kinds[u.kind])} />
                      </td>
                      <td>{Number(u.share).toLocaleString(intlLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">
              <I18nText text="Aucun lot enregistré. Ajoutez votre premier lot pour structurer votre résidence." />
            </p>
          )}
        </section>
        <section className="card">
          <h2>
            <I18nText text="Ajouter un lot" />
          </h2>
          {data.residences.length ? (
            <form action={createUnit} className="form">
              <label>
                <I18nText text="Résidence" />
                <select name="residence_id" required>
                  {data.residences.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <I18nText text="Libellé du lot" />
                <LocalizedInput
                  name="label"
                  required
                  maxLength={60}
                  placeholder="A-101"
                />
              </label>
              <label>
                <I18nText text="Type" />
                <select name="kind">
                  <option value="apartment">
                    <I18nText text="Appartement" />
                  </option>
                  <option value="shop">
                    <I18nText text="Commerce" />
                  </option>
                  <option value="parking">
                    <I18nText text="Parking" />
                  </option>
                </select>
              </label>
              <label>
                <I18nText text="Quote-part" />
                <LocalizedInput
                  name="share"
                  type="number"
                  min="0.0001"
                  max="1000000"
                  step="0.0001"
                  defaultValue="1"
                  required
                />
              </label>
              <p className="form-note">
                <I18nText text="Poids relatif pour une future répartition des charges. Aucune charge n’est générée dans cette version." />
              </p>
              <Submit>
                <I18nText text="Enregistrer le lot" />
              </Submit>
            </form>
          ) : (
            <p>
              <I18nText text="Commencez par" />
              <I18nText text={String(" ")} />
              <Link href="/app/residences" className="text-link">
                <I18nText text="ajouter une résidence" />
              </Link>
              .
            </p>
          )}
        </section>
      </div>
    </>
  );
}
