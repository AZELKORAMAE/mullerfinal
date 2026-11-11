"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signedIn } from "@/lib/access";
import { residenceSchema, unitSchema } from "@/lib/validation";
function result(message: string): never {
  revalidatePath("/app/communaute");
  redirect("/app/communaute?message=" + encodeURIComponent(message));
}
export async function setupResidence(form: FormData) {
  const { db } = await signedIn();
  const input = residenceSchema.safeParse(Object.fromEntries(form));
  if (!input.success) result("Vérifiez les informations de la résidence.");
  const { error } = await db.from("syndic_residences").insert(input.data);
  result(
    error
      ? "Création refusée. Contactez votre administrateur."
      : "Résidence créée. Ajoutez maintenant un appartement.",
  );
}
export async function setupUnit(form: FormData) {
  const { db } = await signedIn();
  const input = unitSchema.safeParse(Object.fromEntries(form));
  if (!input.success) result("Vérifiez les informations de l’appartement.");
  const { error } = await db.from("syndic_units").insert(input.data);
  result(
    error
      ? "Création refusée ou appartement déjà existant."
      : "Appartement ajouté. Vous pouvez maintenant inviter un habitant.",
  );
}
export async function createJoinLink(form: FormData) {
  const { db } = await signedIn();
  const unit = z.uuid().safeParse(form.get("unit_id"));
  if (!unit.success) result("Choisissez un appartement.");
  const { error } = await db.rpc("syndic_create_join_link", {
    target_unit: unit.data,
  });
  result(error ? "Création du lien refusée." : "Lien créé pour 7 jours.");
}
export async function revokeJoinLink(form: FormData) {
  const { db } = await signedIn();
  const token = z.uuid().safeParse(form.get("token"));
  if (!token.success) result("Lien invalide.");
  const { error } = await db.rpc("syndic_revoke_join_link", {
    token: token.data,
  });
  result(error ? "Révocation refusée." : "Lien et accès associé révoqués.");
}
export async function inviteResident(form: FormData) {
  const { db } = await signedIn();
  const input = z
    .object({ unit_id: z.uuid(), email: z.email() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) result("Vérifiez le lot et l’adresse e-mail.");
  const { error } = await db.rpc("syndic_invite_resident", {
    target_unit: input.data.unit_id,
    resident_email: input.data.email,
  });
  if (error) result("Invitation refusée. Vérifiez vos droits sur ce lot.");
  result(
    "Invitation créée pour 7 jours. Transmettez au résident l’adresse de l’espace résident ; aucun e-mail automatique n’a été envoyé.",
  );
}
export async function revokeInvitation(form: FormData) {
  const { db } = await signedIn();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) result("Invitation invalide.");
  const { error } = await db.rpc("syndic_revoke_invitation", {
    target: id.data,
  });
  if (error) result("Révocation refusée.");
  result("Invitation et accès associé révoqués.");
}
export async function publishPost(form: FormData) {
  const { db } = await signedIn();
  const input = z
    .object({
      residence_id: z.uuid(),
      title: z.string().trim().min(3).max(160),
      body: z.string().trim().min(3).max(5000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) result("Vérifiez la résidence, le titre et le texte.");
  const { error } = await db.rpc("syndic_publish_post", {
    target_residence: input.data.residence_id,
    post_title: input.data.title,
    post_body: input.data.body,
  });
  if (error) result("Publication refusée. Vérifiez vos droits.");
  result("Annonce publiée aux résidents de cette résidence.");
}
export async function decideJoinRequest(form: FormData) {
  const { db } = await signedIn();
  const input = z
    .object({ id: z.uuid(), decision: z.enum(["approve", "reject"]) })
    .safeParse(Object.fromEntries(form));
  if (!input.success) result("Demande invalide.");
  const { error } = await db.rpc("syndic_decide_join_request", {
    target: input.data.id,
    approve: input.data.decision === "approve",
  });
  if (error) result("Décision refusée. Vérifiez vos droits.");
  result(
    input.data.decision === "approve"
      ? "Demande approuvée : l’habitant a maintenant accès à son logement."
      : "Demande refusée.",
  );
}
export async function moderateResident(form: FormData) {
  const { db } = await signedIn();
  const input = z
    .object({
      unit: z.uuid(),
      user: z.uuid(),
      task: z.enum(["block", "unblock", "remove"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) result("Action invalide.");
  const v = input.data;
  const { error } =
    v.task === "remove"
      ? await db.rpc("syndic_remove_resident", {
          target_unit: v.unit,
          target_user: v.user,
        })
      : await db.rpc("syndic_set_resident_blocked", {
          target_unit: v.unit,
          target_user: v.user,
          blocked: v.task === "block",
        });
  if (error) result("Action refusée. Vérifiez vos droits.");
  result(
    v.task === "remove"
      ? "Utilisateur supprimé de votre espace."
      : v.task === "block"
        ? "Utilisateur bloqué."
        : "Utilisateur débloqué.",
  );
}
