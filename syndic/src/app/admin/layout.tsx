import { I18nText } from "@/components/i18n";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { platformAdmin } from "@/lib/access";
import { signOut } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { db, user } = await platformAdmin();
  const [accounts, payments] = await Promise.all([
    db
      .from("syndic_account_requests")
      .select("user_id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("syndic_subscription_payments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const pending = (accounts.count ?? 0) + (payments.count ?? 0);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav>
          <Link href="/admin">
            <I18nText text="Administration plateforme" />
            {pending > 0 && <span className="badge">🔔 {pending}</span>}
          </Link>
          <Link href="/app">
            <I18nText text="Espace syndic" />
          </Link>
          <Link href="/resident">
            <I18nText text="Espace résident" />
          </Link>
        </nav>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            {user.email}
            <I18nText text="· Administration" />
          </span>
          <form action={signOut}>
            <button className="text-link">
              <I18nText text="Déconnexion" />
            </button>
          </form>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
