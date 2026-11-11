import { intlLocale as getIntlLocale } from "@/lib/locale-server";
import { LocalizedInput } from "@/components/i18n-input";
import { I18nText, SystemNotification } from "@/components/i18n";
import Link from "next/link";
import { signedIn } from "@/lib/access";
import { Notice } from "@/components/notice";
import { Submit } from "@/components/submit";
import { Brand } from "@/components/brand";
import { operate } from "./actions";
type Context = {
  units: {
    id: string;
    label: string;
    residence: string;
    residence_id: string;
    can_manage: boolean;
  }[];
  residences: { id: string; name: string; can_manage: boolean }[];
};
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; unit?: string; view?: string }>;
}) {
  const intlLocale = await getIntlLocale();
  const mad = (v: number) =>
    new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: "MAD",
    }).format(v / 100);

  const { db } = await signedIn();
  const query = await searchParams;
  const view = [
    "balances",
    "expenses",
    "messages",
    "meetings",
    "notifications",
  ].includes(query.view ?? "")
    ? query.view!
    : "balances";
  await db.rpc("syndic_refresh_my_reminders");
  const [context, charges, payments, expenses, meetings, inbox] =
    await Promise.all([
      db.rpc("syndic_operations_context"),
      db.from("syndic_charge_entries").select("*"),
      db.from("syndic_payment_entries").select("*"),
      db.from("syndic_expense_entries").select("*"),
      db.from("syndic_meetings").select("*").order("starts_at"),
      db
        .from("syndic_inbox")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
  const data = (context.data ?? { units: [], residences: [] }) as Context;
  const managed = data.residences.filter((r) => r.can_manage);
  const selected = data.units.find((u) => u.id === query.unit) ?? data.units[0];
  const messages = selected
    ? await db
        .from("syndic_chat_messages")
        .select("*")
        .eq("unit_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [], error: null };
  const paid = (charge: string) =>
    (payments.data ?? [])
      .filter((p) => p.charge_id === charge)
      .reduce((sum, p) => sum + Number(p.amount_cents), 0);
  const total = (charges.data ?? []).reduce(
    (s, c) => s + Number(c.amount_cents),
    0,
  );
  const received = (payments.data ?? []).reduce(
    (s, p) => s + Number(p.amount_cents),
    0,
  );
  return (
    <div className="container">
      <main className="section">
        <div className="page-heading">
          <div>
            <span className="eyebrow">
              <I18nText text="Ma résidence" />
            </span>
            <h1>
              <I18nText
                text={
                  {
                    balances: "Les comptes, simplement.",
                    expenses: "Dépenses partagées",
                    messages: "Conversations",
                    meetings: "La vie de la résidence",
                    notifications: "Notifications",
                  }[view] ?? "Les comptes, simplement."
                }
              />
            </h1>
          </div>
          {managed.length > 0 && (
            <Link
              href="/operations?view=expenses#nouvelle-depense"
              className="button primary"
            >
              <I18nText text="+ Ajouter" />
            </Link>
          )}
        </div>
        <Notice
          message={query.message}
          error={[
            context,
            charges,
            payments,
            expenses,
            meetings,
            inbox,
            messages,
          ].some((r) => r.error)}
        />
        {(view === "balances" || view === "expenses") && (
          <>
            <div className="stats">
              {[
                ["Appelé", total],
                ["Réglé", received],
                ["À régler", total - received],
              ].map(([label, value]) => (
                <section className="card" key={label}>
                  <p>
                    <I18nText text={String(label)} />
                  </p>
                  <div className="stat-number">{mad(Number(value))}</div>
                </section>
              ))}
            </div>
          </>
        )}
        {(view === "balances" || view === "expenses") && (
          <section className="card" id="comptes">
            <h2>
              <I18nText text="Qui doit quoi ?" />
            </h2>
            {!charges.data?.length && (
              <p>
                <I18nText text="Aucune cotisation pour le moment." />
              </p>
            )}
            {charges.data?.map((c) => {
              const u = data.units.find((u) => u.id === c.unit_id);
              const e = expenses.data?.find((e) => e.id === c.expense_id);
              const balance = Number(c.amount_cents) - paid(c.id);
              return (
                <details key={c.id}>
                  <summary>
                    {u?.label} · {e?.title} — {mad(balance)}
                    <I18nText text="à régler" />
                  </summary>
                  <p>
                    <I18nText text="Montant :" />
                    {mad(Number(c.amount_cents))}
                    <I18nText text="· Échéance :" />
                    <I18nText text={String(" ")} />
                    {e?.due_date}
                  </p>
                  {payments.data
                    ?.filter((p) => p.charge_id === c.id)
                    .map((p) => (
                      <p key={p.id} className="small">
                        {p.paid_on} · {mad(Number(p.amount_cents))}
                        <I18nText text="· Référence" />
                        <I18nText text={String(" ")} />
                        {p.reference}
                      </p>
                    ))}
                  {u?.can_manage && balance > 0 && (
                    <>
                      <form action={operate} className="form">
                        <LocalizedInput
                          type="hidden"
                          name="task"
                          value="payment"
                        />
                        <LocalizedInput
                          type="hidden"
                          name="target"
                          value={c.id}
                        />
                        <label>
                          <I18nText text="Montant reçu en MAD" />
                          <LocalizedInput
                            name="amount"
                            type="number"
                            min="0.01"
                            max={balance / 100}
                            step="0.01"
                            required
                          />
                        </label>
                        <label>
                          <I18nText text="Date de réception" />
                          <LocalizedInput type="date" name="date" required />
                        </label>
                        <label>
                          <I18nText text="Référence du règlement vérifié" />
                          <LocalizedInput
                            name="reference"
                            minLength={3}
                            maxLength={160}
                            required
                          />
                        </label>
                        <Submit>
                          <I18nText text="Enregistrer le règlement" />
                        </Submit>
                      </form>
                      <form action={operate} style={{ marginTop: 12 }}>
                        <LocalizedInput
                          type="hidden"
                          name="task"
                          value="remind"
                        />
                        <LocalizedInput
                          type="hidden"
                          name="target"
                          value={c.id}
                        />
                        <Submit>
                          <I18nText text="Rappeler" />
                        </Submit>
                      </form>
                    </>
                  )}
                </details>
              );
            })}
          </section>
        )}
        {view === "expenses" && managed.length > 0 && (
          <section
            className="card"
            id="nouvelle-depense"
            style={{ marginTop: 24 }}
          >
            <h2>
              <I18nText text="Ajouter une dépense" />
            </h2>
            <form action={operate} className="form">
              <LocalizedInput type="hidden" name="task" value="expense" />
              <label>
                <I18nText text="Résidence" />
                <select name="target">
                  {managed.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <I18nText text="Objet" />
                <LocalizedInput
                  name="title"
                  minLength={3}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                <I18nText text="Combien ? (MAD)" />
                <LocalizedInput
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </label>
              <label>
                <I18nText text="Date limite" />
                <LocalizedInput name="date" type="date" required />
              </label>
              <fieldset>
                <legend>
                  <I18nText text="Pour qui ?" />
                </legend>
                {data.units
                  .filter((u) => u.can_manage)
                  .map((u) => (
                    <label key={u.id} className="check-row">
                      <LocalizedInput
                        type="checkbox"
                        name="units"
                        value={u.id}
                      />
                      {u.residence} · {u.label}
                    </label>
                  ))}
              </fieldset>
              <Submit>
                <I18nText text="Partager la dépense" />
              </Submit>
            </form>
          </section>
        )}
        {view === "messages" && (
          <section className="card" id="messages" style={{ marginTop: 24 }}>
            <h2>
              <I18nText text="Vos échanges" />
            </h2>
            <p>
              <I18nText text="Chaque conversation concerne un seul lot et ses habitants autorisés." />
            </p>
            <div className="actions">
              {data.units.map((u) => (
                <Link
                  className="button outline"
                  key={u.id}
                  href={"/operations?view=messages&unit=" + u.id}
                >
                  {u.residence} · {u.label}
                </Link>
              ))}
            </div>
            {selected ? (
              <>
                <h3 style={{ marginTop: 24 }}>
                  <I18nText text="Lot" />
                  {selected.label}
                </h3>
                <div className="chat-log">
                  {[...(messages.data ?? [])].reverse().map((m) => (
                    <article key={m.id} className="section-note">
                      <strong>
                        <I18nText
                          text={String(
                            m.sender_kind === "syndic" ? "Syndic" : "Habitant",
                          )}
                        />
                      </strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
                      <small>
                        {new Date(m.created_at).toLocaleString(intlLocale, {
                          timeZone: "Africa/Casablanca",
                        })}
                      </small>
                    </article>
                  ))}
                </div>
                <form action={operate} className="form">
                  <LocalizedInput type="hidden" name="task" value="chat" />
                  <LocalizedInput
                    type="hidden"
                    name="target"
                    value={selected.id}
                  />
                  <label>
                    <I18nText text="Votre message" />
                    <textarea name="body" rows={3} required maxLength={3000} />
                  </label>
                  <Submit>
                    <I18nText text="Envoyer" />
                  </Submit>
                </form>
                <p className="small"></p>
              </>
            ) : (
              <p>
                <I18nText text="Aucun lot associé." />
              </p>
            )}
          </section>
        )}
        {view === "meetings" && (
          <section className="card" id="reunions" style={{ marginTop: 24 }}>
            <h2>
              <I18nText text="Réunions" />
            </h2>
            {meetings.data?.length ? (
              meetings.data.map((m) => (
                <article key={m.id} className="section-note">
                  <strong>{m.title}</strong>
                  <p>
                    {new Date(m.starts_at).toLocaleString(intlLocale, {
                      timeZone: "Africa/Casablanca",
                    })}
                    <I18nText text={String(" ")} />
                    <I18nText text="· Heure du Maroc" />
                  </p>
                  <p>{m.location}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{m.agenda}</p>
                </article>
              ))
            ) : (
              <p>
                <I18nText text="Aucune réunion programmée." />
              </p>
            )}
            {managed.length > 0 && (
              <details>
                <summary>
                  <I18nText text="Programmer une réunion" />
                </summary>
                <form action={operate} className="form">
                  <LocalizedInput type="hidden" name="task" value="meeting" />
                  <label>
                    <I18nText text="Résidence" />
                    <select name="target">
                      {managed.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
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
                    <I18nText text="Date et heure au Maroc" />
                    <LocalizedInput
                      name="date"
                      type="datetime-local"
                      required
                    />
                    <span className="form-note">
                      <I18nText text="Le fuseau horaire du Maroc est appliqué automatiquement." />
                    </span>
                  </label>
                  <label>
                    <I18nText text="Lieu ou lien de réunion" />
                    <LocalizedInput
                      name="location"
                      required
                      minLength={3}
                      maxLength={300}
                    />
                  </label>
                  <label>
                    <I18nText text="Ordre du jour" />
                    <textarea name="body" maxLength={5000} />
                  </label>
                  <Submit>
                    <I18nText text="Programmer" />
                  </Submit>
                </form>
              </details>
            )}
            <p className="small">
              <I18nText text="Un rappel dans le site apparaît lors d’une visite dans les 24 heures précédant la réunion." />
            </p>
          </section>
        )}
        {view === "notifications" && (
          <section
            className="card"
            id="notifications"
            style={{ marginTop: 24 }}
          >
            <h2>
              <I18nText text="Notifications" />
            </h2>
            {inbox.data?.length ? (
              inbox.data.map((n) => (
                <article className="list-row" key={n.id}>
                  <div>
                    <strong><SystemNotification text={n.title} /></strong>
                    <p className="small">
                      {new Date(n.created_at).toLocaleString(intlLocale, {
                        timeZone: "Africa/Casablanca",
                      })}
                    </p>
                  </div>
                  {!n.read_at && (
                    <form action={operate}>
                      <LocalizedInput type="hidden" name="task" value="read" />
                      <LocalizedInput
                        type="hidden"
                        name="target"
                        value={n.id}
                      />
                      <Submit>
                        <I18nText text="Marquer comme lu" />
                      </Submit>
                    </form>
                  )}
                </article>
              ))
            ) : (
              <p>
                <I18nText text="Aucune notification." />
              </p>
            )}
          </section>
        )}
        {view === "balances" && (
          <div className="quick-grid">
            <Link href="/operations?view=expenses">
              <I18nText text="Dépenses et soldes →" />
            </Link>
            <Link href="/operations?view=messages">
              <I18nText text="Écrire au syndic →" />
            </Link>
            <Link href="/incidents">
              <I18nText text="Signaler un problème →" />
            </Link>
            <Link href="/operations/export">
              <I18nText text="Exporter mes comptes →" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
