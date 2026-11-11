"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { signedIn } from "@/lib/access";
export async function acceptInvitation(form: FormData) {
  const { db } = await signedIn();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) redirect("/resident?message=Invitation%20invalide.");
  const { error } = await db.rpc("syndic_accept_invitation", {
    target: id.data,
  });
  if (error)
    redirect(
      "/resident?message=Invitation%20expirée%20ou%20adresse%20e-mail%20non%20vérifiée.",
    );
  revalidatePath("/resident");
  redirect("/resident?message=Invitation%20acceptée.");
}
