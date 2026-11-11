"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redirect } from "next/navigation";
import { provisionClient } from "@/lib/provision";
import { supabase } from "@/lib/supabase/server";
export async function joinResidence(form: FormData) {
  const input = z
    .object({
      token: z.uuid(),
      first_name: z.string().trim().min(2).max(80),
      last_name: z.string().trim().min(2).max(80),
      nickname: z.string().trim().min(2).max(40),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ()-]{8,24}$/),
      email: z.email(),
      password: z.string().min(12).max(128),
    })
    .safeParse(Object.fromEntries(form));
  const token = z.uuid().safeParse(form.get("token"));
  if (!token.success) redirect("/connexion");
  const back = "/rejoindre/" + token.data;
  if (!input.success)
    redirect(back + "?message=Vérifiez%20vos%20informations.");
  const v = input.data;
  const attempt = randomUUID();
  let created = false;
  let success = false;
  try {
    const service = provisionClient();
    const { data: reserved, error } = await service.rpc(
      "syndic_reserve_join_link",
      { token: v.token, attempt },
    );
    if (error || reserved !== true)
      redirect(
        back +
          "?message=Invitation%20indisponible%20ou%20en%20cours%20d’utilisation.",
      );
    const result = await service.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
      user_metadata: {
        first_name: v.first_name,
        last_name: v.last_name,
        nickname: v.nickname,
        phone: v.phone,
      },
    });
    if (result.error || !result.data.user) {
      await service.rpc("syndic_release_join_link", {
        token: v.token,
        attempt,
      });
    } else {
      created = true;
      const complete = await service.rpc("syndic_request_join_link", {
        token: v.token,
        attempt,
        account_id: result.data.user.id,
      });
      success = !complete.error;
    }
  } catch {}
  if (!success)
    redirect(
      back +
        "?message=" +
        encodeURIComponent(
          created
            ? "Votre compte est créé, mais la demande n’a pas pu être envoyée. Connectez-vous puis rouvrez le lien."
            : "Création impossible. Cette adresse possède peut-être déjà un compte : connectez-vous pour rejoindre la résidence.",
        ),
    );
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: v.email,
    password: v.password,
  });
  redirect(
    error
      ? "/connexion?message=Votre%20compte%20est%20créé.%20Connectez-vous."
      : "/resident?message=" + encodeURIComponent(sent),
  );
}
const sent =
  "Demande envoyée. Votre syndic doit l’approuver avant l’ouverture de votre accès.";
export async function joinWithAccount(form: FormData) {
  const token = z.uuid().safeParse(form.get("token"));
  if (!token.success) redirect("/connexion");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    redirect(
      "/connexion?next=" + encodeURIComponent("/rejoindre/" + token.data),
    );
  const { error } = await db.rpc("syndic_request_join", {
    token: token.data,
  });
  if (error)
    redirect(
      "/rejoindre/" +
        token.data +
        "?message=" +
        encodeURIComponent(
          "Demande impossible : lien déjà utilisé, expiré, ou vous avez déjà accès à ce logement.",
        ),
    );
  redirect("/resident?message=" + encodeURIComponent(sent));
}
