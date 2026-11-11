import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import { signedIn } from "@/lib/access";
import { workspace } from "@/lib/data";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";
import { inviteResident, revokeInvitation, publishPost } from "./actions";
import { provisionResident } from "@/app/admin/provision";
import { ShareLink } from "@/components/share-link";
import { createJoinLink, revokeJoinLink } from "./actions";
import { setupResidence, setupUnit } from "./actions";
import { decideJoinRequest, moderateResident } from "./actions";
type People = {
  residents: {
    unit_id: string;
    user_id: string;
    unit: string;
    residence: string;
    email: string;
    name: string;
    phone: string;
    blocked: boolean;
    revoked: boolean;
  }[];
  requests: {
    id: string;
    unit: string;
    residence: string;
    email: string;
    name: string;
    phone: string;
    created_at: string;
  }[];
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db } = await signedIn();
  const data = await workspace();
  const links = await db
    .from("syndic_join_links")
    .select("id,unit_id,expires_at,used_by,revoked_at")
    .order("created_at", { ascending: false });
  const [invitations, posts, peopleResult] = await Promise.all([
    db
      .from("syndic_resident_invitations")
      .select("*")
      .order("created_at", { ascending: false }),
    db
      .from("syndic_residence_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    db.rpc("syndic_manager_people"),
  ]);
  const people = (peopleResult.data ?? {
    residents: [],
    requests: [],
  }) as People;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            <I18nText text="Résidents et activités" />
          </h1>
          <p>
            <I18nText text="Invitez les occupants d’un lot et partagez les actualités de leur résidence." />
          </p>
        </div>
      </div>
      <Notice
        message={(await searchParams).message}
        error={
          data.error ||
          Boolean(invitations.error || posts.error || peopleResult.error)
        }
      />
      <section className="card" style={{ marginBottom: 24 }}>
        <h2>
          <I18nText text="Demandes d’adhésion" />
        </h2>
        {!people.requests.length && (
          <p>
            <I18nText text="Aucune demande en attente." />
          </p>
        )}
        {people.requests.map((r) => (
          <article key={r.id} className="list-row">
            <div>
              <strong>{r.name || r.email}</strong>
              <p className="small">
                {r.email} {r.phone ? "· " + r.phone : ""}
              </p>
              <p className="small">
                {r.residence} · {r.unit}
              </p>
            </div>
            <div className="row-actions">
              <form action={decideJoinRequest}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="decision" value="approve" />
                <Submit>
                  <I18nText text="Approuver" />
                </Submit>
              </form>
              <form action={decideJoinRequest}>
                <input type="hidden" name="id" value={r.id} />
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
          <I18nText text="Utilisateurs de mon espace" />
        </h2>
        {!people.residents.length && (
          <p>
            <I18nText text="Aucun habitant pour le moment." />
          </p>
        )}
        {people.residents.map((r) => (
          <article key={r.unit_id + r.user_id} className="list-row">
            <div>
              <strong>{r.name || r.email}</strong>
              <p className="small">
                {r.email} {r.phone ? "· " + r.phone : ""}
              </p>
              <p className="small">
                {r.residence} · {r.unit} ·{" "}
                <span
                  className={
                    "status-pill " +
                    (r.blocked || r.revoked ? "danger" : "ok")
                  }
                >
                  <I18nText
                    text={
                      r.blocked ? "Bloqué" : r.revoked ? "Révoqué" : "Actif"
                    }
                  />
                </span>
              </p>
            </div>
            <div className="row-actions">
              {(r.blocked || !r.revoked) && (
                <form action={moderateResident}>
                  <input type="hidden" name="unit" value={r.unit_id} />
                  <input type="hidden" name="user" value={r.user_id} />
                  <input
                    type="hidden"
                    name="task"
                    value={r.blocked ? "unblock" : "block"}
                  />
                  <Submit>
                    <I18nText text={r.blocked ? "Débloquer" : "Bloquer"} />
                  </Submit>
                </form>
              )}
              <form action={moderateResident}>
                <input type="hidden" name="unit" value={r.unit_id} />
                <input type="hidden" name="user" value={r.user_id} />
                <input type="hidden" name="task" value="remove" />
                <Submit>
                  <I18nText text="Supprimer" />
                </Submit>
              </form>
            </div>
          </article>
        ))}
      </section>
      <section className="card" style={{ marginBottom: 24 }}>
        <h2>
          <I18nText text="Inviter par lien" />
        </h2>
        {!data.organizations.length && (
          <div className="notice">
            <I18nText text="Votre compte n’est associé à aucune organisation de syndic. Connectez-vous avec le compte syndic créé dans Administration ; le compte administrateur de plateforme ne reçoit pas automatiquement les droits de ses clients." />
          </div>
        )}
        {data.organizations.length > 0 && !data.residences.length && (
          <form action={setupResidence} className="form">
            <h3>
              <I18nText text="Créez votre première résidence" />
            </h3>
            <label>
              <I18nText text="Organisation" />
              <select name="organization_id">
                {data.organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <I18nText text="Nom de la résidence" />
              <LocalizedInput
                name="name"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              <I18nText text="Adresse" />
              <LocalizedInput
                name="address"
                minLength={4}
                maxLength={300}
                required
              />
            </label>
            <label>
              <I18nText text="Ville" />
              <LocalizedInput
                name="city"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <Submit>
              <I18nText text="Créer la résidence" />
            </Submit>
          </form>
        )}
        {data.residences.length > 0 && !data.units.length && (
          <form action={setupUnit} className="form">
            <h3>
              <I18nText text="Ajoutez un appartement pour inviter un habitant" />
            </h3>
            <label>
              <I18nText text="Résidence" />
              <select name="residence_id">
                {data.residences.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <I18nText text="Appartement" />
              <LocalizedInput
                name="label"
                placeholder="A-101"
                maxLength={60}
                required
              />
            </label>
            <LocalizedInput type="hidden" name="kind" value="apartment" />
            <LocalizedInput type="hidden" name="share" value="1" />
            <Submit>
              <I18nText text="Ajouter l’appartement" />
            </Submit>
          </form>
        )}
        {links.error && (
          <div role="alert" className="notice">
            <I18nText text="Les invitations sont momentanément indisponibles. Réessayez ou contactez votre administrateur." />
          </div>
        )}
        {data.units.length > 0 && (
          <form action={createJoinLink} className="form">
            <label>
              <I18nText text="Appartement" />
              <select name="unit_id">
                {data.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {data.residences.find((r) => r.id === u.residence_id)?.name}
                    <I18nText text={String(" ")} />· {u.label}
                  </option>
                ))}
              </select>
            </label>
            <Submit>
              <I18nText text="Créer un lien d’invitation" />
            </Submit>
          </form>
        )}
        {links.data?.map((link) => (
          <article key={link.id} className="list-row">
            <div>
              <strong>
                {data.units.find((u) => u.id === link.unit_id)?.label}
              </strong>
              <p className="small">
                <I18nText
                  text={String(
                    link.revoked_at
                      ? "Révoqué"
                      : link.used_by
                        ? "Lien utilisé"
                        : new Date(link.expires_at) < new Date()
                          ? "Expiré"
                          : "En attente",
                  )}
                />
              </p>
              {!link.used_by && !link.revoked_at && (
                <ShareLink
                  url={`${process.env.NEXT_PUBLIC_SITE_URL}/rejoindre/${link.id}`}
                />
              )}
            </div>
            {!link.revoked_at && (
              <form action={revokeJoinLink}>
                <LocalizedInput type="hidden" name="token" value={link.id} />
                <Submit>
                  <I18nText text="Révoquer" />
                </Submit>
              </form>
            )}
          </article>
        ))}
      </section>
      <div className="split">
        <section className="card">
          <h2>
            <I18nText text="Créer un accès habitant" />
          </h2>
          {data.units.length > 0 && (
            <form action={provisionResident} className="form">
              <label>
                <I18nText text="Lot" />
                <select name="unit">
                  {data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <I18nText text="E-mail" />
                <LocalizedInput name="email" type="email" required />
              </label>
              <label>
                <I18nText text="Mot de passe initial" />
                <LocalizedInput
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <Submit>
                <I18nText text="Créer l’accès sans e-mail" />
              </Submit>
            </form>
          )}
          <h3 style={{ marginTop: 24 }}>
            <I18nText text="Associer un compte existant par invitation" />
          </h3>
          {data.units.length ? (
            <form action={inviteResident} className="form">
              <label>
                <I18nText text="Lot" />
                <select name="unit_id" required>
                  {data.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {
                        data.residences.find((r) => r.id === u.residence_id)
                          ?.name
                      }
                      <I18nText text={String(" ")} />· {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <I18nText text="E-mail du résident" />
                <LocalizedInput
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                />
              </label>
              <Submit>
                <I18nText text="Créer l’invitation" />
              </Submit>
              <p className="form-note">
                <I18nText text="Le résident devra créer son compte avec cette adresse, la vérifier et accepter l’invitation. Partagez-lui :" />
                <I18nText text={String(" ")} />
                {process.env.NEXT_PUBLIC_SITE_URL}
                <I18nText text="/resident" />
              </p>
            </form>
          ) : (
            <p>
              <I18nText text="Ajoutez d’abord une résidence et un lot." />
            </p>
          )}
        </section>
        <section className="card">
          <h2>
            <I18nText text="Publier une activité" />
          </h2>
          {data.residences.length ? (
            <form action={publishPost} className="form">
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
                <I18nText text="Titre" />
                <LocalizedInput
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                />
              </label>
              <label>
                <I18nText text="Message" />
                <textarea
                  name="body"
                  required
                  minLength={3}
                  maxLength={5000}
                  rows={5}
                />
              </label>
              <Submit>
                <I18nText text="Publier aux résidents" />
              </Submit>
            </form>
          ) : (
            <p>
              <I18nText text="Ajoutez d’abord une résidence." />
            </p>
          )}
        </section>
      </div>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>
          <I18nText text="Invitations et accès" />
        </h2>
        {!invitations.data?.length && (
          <p>
            <I18nText text="Aucune invitation." />
          </p>
        )}
        {invitations.data?.map((i) => (
          <div className="list-row" key={i.id}>
            <div>
              <strong>{i.email}</strong>
              {!i.revoked_at && !i.accepted_at && (
                <ShareLink
                  url={`${process.env.NEXT_PUBLIC_SITE_URL}/invitation/${i.id}`}
                />
              )}
              <p>
                {data.units.find((u) => u.id === i.unit_id)?.label ?? "Lot"} ·
                <I18nText text={String(" ")} />
                <I18nText
                  text={String(
                    i.revoked_at
                      ? "Révoqué"
                      : i.accepted_at
                        ? "Accès accepté"
                        : new Date(i.expires_at) < new Date()
                          ? "Invitation expirée"
                          : "En attente",
                  )}
                />
              </p>
            </div>
            {!i.revoked_at && (
              <form action={revokeInvitation}>
                <LocalizedInput type="hidden" name="id" value={i.id} />
                <Submit>
                  <I18nText text="Révoquer l’accès" />
                </Submit>
              </form>
            )}
          </div>
        ))}
      </section>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>
          <I18nText text="Activités publiées" />
        </h2>
        {posts.data?.length ? (
          posts.data.map((p) => (
            <article key={p.id} className="section-note">
              <strong>{p.title}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
              <span className="small">
                {data.residences.find((r) => r.id === p.residence_id)?.name}
              </span>
            </article>
          ))
        ) : (
          <p>
            <I18nText text="Aucune activité publiée." />
          </p>
        )}
      </section>
    </>
  );
}
