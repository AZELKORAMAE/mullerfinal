"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signedIn } from "@/lib/access";
import { provisionClient } from "@/lib/provision";
import { STANDARD_MONTHLY_CENTS } from "@/lib/plans";
const PATH = "/app/abonnement";
const BUCKET = "syndic-payment-proofs";
const types: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
function done(text: string): never {
  revalidatePath(PATH);
  redirect(PATH + "?message=" + encodeURIComponent(text));
}
export async function submitPayment(form: FormData) {
  const { db, user } = await signedIn();
  const input = z
    .object({
      plan: z.enum(["standard", "entreprise"]),
      months: z.coerce.number().int().min(1).max(24),
      amount: z.coerce.number().min(0).max(1000000).optional(),
      reference: z.string().trim().max(160).default(""),
    })
    .safeParse({
      plan: form.get("plan"),
      months: form.get("months"),
      amount: form.get("amount") || undefined,
      reference: form.get("reference") ?? "",
    });
  if (!input.success) done("Vérifiez le plan, la durée et le montant.");
  const v = input.data;
  const file = form.get("proof");
  if (!(file instanceof File) || file.size === 0)
    done("Ajoutez la capture d’écran de votre virement.");
  if (file.size > 5 * 1024 * 1024 || !types[file.type])
    done("Format accepté : image PNG, JPG, WEBP ou PDF de 5 Mo maximum.");
  const amountCents =
    v.plan === "standard"
      ? STANDARD_MONTHLY_CENTS * v.months
      : Math.round((v.amount ?? 0) * 100);
  if (amountCents <= 0) done("Indiquez le montant viré.");
  const { data: membership } = await db
    .from("syndic_organization_members")
    .select("organization_id,role")
    .eq("user_id", user.id)
    .in("role", ["admin", "manager"])
    .limit(1);
  const orgId = membership?.[0]?.organization_id;
  if (!orgId) redirect("/acces-refuse");
  const path = `${orgId}/${randomUUID()}.${types[file.type]}`;
  let ok = false;
  try {
    const storage = provisionClient().storage.from(BUCKET);
    const upload = await storage.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (!upload.error) {
      const { error } = await db.rpc("syndic_submit_subscription_payment", {
        target_org: orgId,
        plan_choice: v.plan,
        month_count: v.months,
        paid_cents: amountCents,
        payment_reference: v.reference,
        proof: path,
      });
      ok = !error;
      if (error) await storage.remove([path]);
    }
  } catch {}
  done(
    ok
      ? "Paiement envoyé. Votre abonnement sera prolongé dès la validation du virement."
      : "Envoi impossible. Vérifiez vos informations (3 paiements en attente maximum) ou réessayez.",
  );
}
