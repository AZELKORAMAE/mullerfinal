"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { platformAdmin, signedIn } from "@/lib/access";
import { provisionClient } from "@/lib/provision";
export async function provisionSyndic(form: FormData) {
  await platformAdmin();
  const input = z
    .object({
      email: z.email(),
      password: z.string().min(12).max(128),
      organization: z.string().trim().min(2).max(120),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) redirect("/admin?message=Vérifiez%20les%20champs.");
  let success = false;
  try {
    const service = provisionClient();
    const { data, error } = await service.auth.admin.createUser({
      email: input.data.email,
      password: input.data.password,
      email_confirm: true,
    });
    if (error || !data.user) throw Error();
    const created = await service.rpc("syndic_provision_organization", {
      account_id: data.user.id,
      organization_name: input.data.organization,
    });
    success = !created.error;
  } catch {}
  redirect(
    "/admin?message=" +
      encodeURIComponent(
        success
          ? "Compte syndic créé. Transmettez ses identifiants par un canal privé. Aucun e-mail envoyé."
          : "Création indisponible. Vérifiez la configuration serveur ou si cette adresse possède déjà un compte.",
      ),
  );
}
export async function provisionResident(form: FormData) {
  const { db, user } = await signedIn();
  const input = z
    .object({
      email: z.email(),
      password: z.string().min(12).max(128),
      unit: z.uuid(),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    redirect("/app/communaute?message=Vérifiez%20les%20champs.");
  const { data: units } = await db
    .from("syndic_units")
    .select("residence_id")
    .eq("id", input.data.unit)
    .single();
  if (!units) redirect("/acces-refuse");
  const { data: allowed } = await db.rpc("syndic_manages_residence", {
    target: units.residence_id,
  });
  if (allowed !== true) redirect("/acces-refuse");
  let success = false;
  try {
    const service = provisionClient();
    const { data, error } = await service.auth.admin.createUser({
      email: input.data.email,
      password: input.data.password,
      email_confirm: true,
    });
    if (error || !data.user) throw Error();
    const { error: associationError } = await service.rpc(
      "syndic_provision_resident",
      {
        account_id: data.user.id,
        target_unit: input.data.unit,
        manager_id: user.id,
      },
    );
    if (associationError) throw Error();
    success = true;
  } catch {}
  redirect(
    "/app/communaute?message=" +
      encodeURIComponent(
        success
          ? "Compte habitant créé et associé au lot. Aucun e-mail envoyé."
          : "Création indisponible. Vérifiez la configuration serveur ou si cette adresse possède déjà un compte.",
      ),
  );
}
