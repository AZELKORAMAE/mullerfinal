import { signedIn } from "@/lib/access";
import { currentLocale } from "@/lib/locale-server";
function cell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export async function GET() {
  const locale = await currentLocale();
  const { db } = await signedIn();
  const [context, charges, payments, expenses] = await Promise.all([
    db.rpc("syndic_operations_context"),
    db.from("syndic_charge_entries").select("*"),
    db.from("syndic_payment_entries").select("*"),
    db.from("syndic_expense_entries").select("*"),
  ]);
  if ([context, charges, payments, expenses].some((r) => r.error))
    return new Response(locale === "ar" ? "التصدير غير متاح" : locale === "en" ? "Export unavailable" : "Export indisponible", { status: 503 });
  const units = (context.data?.units ?? []) as {
    id: string;
    label: string;
    residence: string;
  }[];
  const rows = [
    locale === "ar" ? ["الإقامة", "الوحدة", "الموضوع", "تاريخ الاستحقاق", "المستحق MAD", "المدفوع MAD", "الرصيد MAD"] : locale === "en" ? ["Residence", "Unit", "Subject", "Due date", "Charged MAD", "Paid MAD", "Balance MAD"] : [
      "Résidence",
      "Lot",
      "Objet",
      "Échéance",
      "Appelé MAD",
      "Réglé MAD",
      "Solde MAD",
    ],
  ];
  for (const c of charges.data ?? []) {
    const u = units.find((u) => u.id === c.unit_id);
    const e = expenses.data?.find((e) => e.id === c.expense_id);
    const paid =
      payments.data
        ?.filter((p) => p.charge_id === c.id)
        .reduce((s, p) => s + Number(p.amount_cents), 0) ?? 0;
    rows.push([
      u?.residence ?? "",
      u?.label ?? "",
      e?.title ?? "",
      e?.due_date ?? "",
      (Number(c.amount_cents) / 100).toFixed(2),
      (paid / 100).toFixed(2),
      ((Number(c.amount_cents) - paid) / 100).toFixed(2),
    ]);
  }
  return new Response(
    "\ufeff" + rows.map((r) => r.map(cell).join(";")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cotisations.csv"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
