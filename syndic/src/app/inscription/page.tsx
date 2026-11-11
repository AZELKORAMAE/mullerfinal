import Link from "next/link";
import { I18nText } from "@/components/i18n";
import { Brand } from "@/components/brand";
import { Notice } from "@/components/notice";
import { SignUpForm } from "@/components/signup-form";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; syndic?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = /^\/rejoindre\/[0-9a-f-]{36}$/i.test(params.next ?? "")
    ? params.next
    : undefined;
  return (
    <main className="auth-shell">
      <div className="card auth-card">
        <Brand />
        <h1>
          <I18nText text="Créer votre compte" />
        </h1>
        <p>
          <I18nText text="Habitant ou syndic, créez votre compte en une minute." />
        </p>
        <Notice message={params.message} />
        <SignUpForm syndic={params.syndic === "1"} next={next} />
        <p className="small" style={{ marginTop: 24 }}>
          <I18nText text="Vous avez déjà un compte ?" />
          <Link
            className="text-link"
            href={
              next
                ? `/connexion?next=${encodeURIComponent(next)}`
                : "/connexion"
            }
          >
            <I18nText text="Se connecter" />
          </Link>
        </p>
      </div>
    </main>
  );
}
