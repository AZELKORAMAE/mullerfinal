"use server";
import { signedIn } from "@/lib/access";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function saveNickname(form: FormData) {
  const { db } = await signedIn();
  const nickname = z
    .string()
    .trim()
    .min(2)
    .max(40)
    .safeParse(form.get("nickname"));
  if (!nickname.success) redirect("/compte?message=Pseudo%20invalide.");
  const { error } = await db.auth.updateUser({
    data: { nickname: nickname.data },
  });
  revalidatePath("/compte");
  redirect(
    "/compte?message=" +
      encodeURIComponent(
        error ? "Enregistrement impossible." : "Profil enregistré.",
      ),
  );
}
