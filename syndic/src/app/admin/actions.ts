"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { platformAdmin } from "@/lib/access";
export async function setSubscription(form: FormData) {
  const { db } = await platformAdmin();
  const input = z
    .object({
      organization_id: z.uuid(),
      plan: z.enum([
        "essai",
        "standard",
        "entreprise",
        "essentiel",
        "pro",
        "business",
      ]),
      status: z.enum([
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
        "suspended",
      ]),
      end_date: z.iso.date(),
      reason: z.string().trim().min(5).max(500),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    redirect("/admin?message=Vérifiez%20les%20champs%20et%20le%20motif.");
  const v = input.data;
  const { error } = await db.rpc("syndic_set_subscription", {
    target: v.organization_id,
    selected_plan: v.plan,
    selected_status: v.status,
    end_date: `${v.end_date}T23:59:59Z`,
    reason: v.reason,
  });
  if (error)
    redirect(
      "/admin?message=Modification%20refusée.%20Vérifiez%20la%20date%20de%20fin.",
    );
  revalidatePath("/admin");
  redirect("/admin?message=Abonnement%20mis%20à%20jour%20et%20historisé.");
}
function back(text: string): never {
  revalidatePath("/admin");
  redirect("/admin?message=" + encodeURIComponent(text));
}
export async function decideAccount(form: FormData) {
  const { db } = await platformAdmin();
  const input = z
    .object({ user_id: z.uuid(), decision: z.enum(["approve", "reject"]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) back("Demande invalide.");
  const { error } = await db.rpc("syndic_admin_decide_account", {
    target: input.data.user_id,
    approve: input.data.decision === "approve",
  });
  if (error) back("Décision impossible : demande déjà traitée.");
  back(
    input.data.decision === "approve"
      ? "Compte syndic approuvé : essai gratuit d’un mois activé."
      : "Demande de compte syndic refusée.",
  );
}
export async function reviewPayment(form: FormData) {
  const { db } = await platformAdmin();
  const input = z
    .object({
      id: z.uuid(),
      decision: z.enum(["approve", "reject"]),
      note: z.string().trim().max(500).default(""),
    })
    .safeParse({
      id: form.get("id"),
      decision: form.get("decision"),
      note: form.get("note") ?? "",
    });
  if (!input.success) back("Paiement invalide.");
  const { error } = await db.rpc("syndic_admin_review_payment", {
    target: input.data.id,
    approve: input.data.decision === "approve",
    note: input.data.note,
  });
  if (error) back("Décision impossible : paiement déjà traité.");
  back(
    input.data.decision === "approve"
      ? "Paiement validé : abonnement prolongé."
      : "Paiement refusé.",
  );
}
export async function saveBilling(form: FormData) {
  const { db } = await platformAdmin();
  const input = z
    .object({
      account_holder: z.string().trim().max(160),
      bank_name: z.string().trim().max(160),
      rib: z.string().trim().max(64),
      instructions: z.string().trim().max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) back("Vérifiez les coordonnées bancaires.");
  const { error } = await db.rpc("syndic_admin_set_billing", {
    holder: input.data.account_holder,
    bank: input.data.bank_name,
    account_rib: input.data.rib,
    notes: input.data.instructions,
  });
  back(error ? "Enregistrement impossible." : "Coordonnées bancaires enregistrées.");
}
