import { LocalizedInput } from "@/components/i18n-input";
import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { signedIn } from "@/lib/access";
import { acceptInvitation } from "@/app/resident/actions";
import { Submit } from "@/components/submit";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db } = await signedIn();
  const { id } = await params;
  const { data } = await db
    .from("syndic_resident_invitations")
    .select("id,expires_at,accepted_at,revoked_at")
    .eq("id", id)
    .single();
  const valid =
    data &&
    !data.revoked_at &&
    !data.accepted_at &&
    new Date(data.expires_at) > new Date();
  return (
    <main className="auth-shell">
      <section className="card auth-card">
        <span className="eyebrow">
          <I18nText text="Votre résidence" />
        </span>
        <h1>
          <I18nText
            text={String(
              valid ? "Bienvenue chez vous." : "Invitation indisponible",
            )}
          />
        </h1>
        {valid ? (
          <form action={acceptInvitation}>
            <LocalizedInput type="hidden" name="id" value={data.id} />
            <Submit>
              <I18nText text="Rejoindre mon appartement" />
            </Submit>
          </form>
        ) : (
          <Link className="button primary" href="/resident">
            <I18nText text="Mon espace" />
          </Link>
        )}
      </section>
    </main>
  );
}
