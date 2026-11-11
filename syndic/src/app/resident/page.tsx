import { intlLocale as getIntlLocale } from "@/lib/locale-server";
import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { signedIn } from "@/lib/access";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";
import { signOut } from "@/app/actions";
import { acceptInvitation } from "./actions";
type ResidentSpace = {
  units: {
    id: string;
    label: string;
    residence: string;
    residence_id: string;
    city: string;
  }[];
  posts: {
    id: string;
    title: string;
    body: string;
    created_at: string;
    residence_id: string;
  }[];
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const intlLocale = await getIntlLocale();

  const { db, user } = await signedIn();
  const [space, invitations, requests] = await Promise.all([
    db.rpc("syndic_my_resident_space"),
    db
      .from("syndic_resident_invitations")
      .select("id,expires_at")
      .eq("email", user.email?.toLowerCase() ?? "")
      .is("revoked_at", null)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    db.rpc("syndic_my_join_requests"),
  ]);
  const myRequests = ((requests.data ?? []) as {
    id: string;
    status: string;
    unit: string;
    residence: string;
  }[]).filter((r) => r.status !== "approved");
  const data = (space.data ?? { units: [], posts: [] }) as ResidentSpace;
  return (
    <div className="container">
      <header className="public-nav">
        <Brand />
        <form action={signOut}>
          <button className="text-link">
            <I18nText text="Déconnexion" />
          </button>
        </form>
      </header>
      <main className="section">
        <span className="eyebrow">
          <I18nText text="Mon espace résident" />
        </span>
        <h1>
          <I18nText text="Chez vous." />
        </h1>
        <Link href="/incidents" className="button outline">
          <I18nText text="Signaler un incident" />
        </Link>
        <Link href="/operations" className="button primary">
          <I18nText text="Mes cotisations, messages et réunions" />
        </Link>
        <p>{user.email}</p>
        <Notice
          message={(await searchParams).message}
          error={Boolean(space.error || invitations.error)}
        />
        {myRequests.map((r) => (
          <section key={r.id} className="card" style={{ marginBottom: 20 }}>
            <h2>
              {r.residence} · {r.unit}
            </h2>
            <p>
              <I18nText
                text={
                  r.status === "pending"
                    ? "Demande d’adhésion en attente de validation par votre syndic."
                    : "Votre demande d’adhésion a été refusée. Contactez votre syndic."
                }
              />
            </p>
          </section>
        ))}
        {invitations.data?.map((i) => (
          <section key={i.id} className="card" style={{ marginBottom: 20 }}>
            <h2>
              <I18nText text="Une invitation vous attend" />
            </h2>
            <p></p>
            <form action={acceptInvitation}>
              <LocalizedInput type="hidden" name="id" value={i.id} />
              <Submit>
                <I18nText text="Accepter l’invitation" />
              </Submit>
            </form>
          </section>
        ))}
        <div className="grid3">
          {data.units.map((u) => (
            <section className="card" key={u.id}>
              <span className="badge">{u.city}</span>
              <h2 style={{ marginTop: 12 }}>{u.residence}</h2>
              <p>
                <I18nText text="Lot" />
                {u.label}
              </p>
            </section>
          ))}
        </div>
        {!data.units.length && (
          <section className="card">
            <h2>
              <I18nText text="En attente de votre syndic" />
            </h2>
            <p>
              <I18nText text="Demandez une invitation à l’adresse de votre compte. Aucun lot n’est encore associé à votre compte." />
            </p>
            <p>
              <Link href="/en-attente" className="text-link">
                <I18nText text="Vous êtes syndic ? Demander un compte syndic" />
              </Link>
            </p>
          </section>
        )}
        <section style={{ marginTop: 32 }}>
          <h2>
            <I18nText text="Activités et annonces" />
          </h2>
          {data.posts.length ? (
            data.posts.map((p) => (
              <article className="card" key={p.id} style={{ marginBottom: 16 }}>
                <span className="small">
                  {new Date(p.created_at).toLocaleDateString(intlLocale)}
                </span>
                <h3>{p.title}</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
              </article>
            ))
          ) : (
            <p>
              <I18nText text="Aucune activité publiée pour le moment." />
            </p>
          )}
        </section>
        <Link href="/app" className="text-link small">
          <I18nText text="Accéder à mon espace syndic" />
        </Link>
      </main>
    </div>
  );
}
