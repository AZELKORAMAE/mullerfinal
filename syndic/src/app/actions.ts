"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import {
  signUpSchema,
  organizationSchema,
  residenceSchema,
  unitSchema,
} from "@/lib/validation";
function message(path: string, text: string): never {
  redirect(`${path}?message=${encodeURIComponent(text)}`);
}
function safeNext(value: FormDataEntryValue | null) {
  const next = String(value ?? "");
  return /^\/rejoindre\/[0-9a-f-]{36}$/i.test(next) ? next : "";
}
async function landingFor(db: Awaited<ReturnType<typeof supabase>>) {
  const { data } = await db.rpc("syndic_my_status");
  const status = (data ?? {}) as {
    admin?: boolean;
    member?: boolean;
    resident?: boolean;
    request?: string | null;
  };
  if (status.admin) return "/admin";
  if (status.member) return "/app";
  if (status.request === "pending" || status.request === "rejected")
    return "/en-attente";
  if (status.resident) return "/operations";
  return "/resident";
}
export async function signIn(form: FormData) {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const back = next ? `/connexion?next=${encodeURIComponent(next)}&` : "/connexion?";
  if (!email || !password)
    redirect(back + "message=" + encodeURIComponent("Renseignez votre e-mail et votre mot de passe."));
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error)
    redirect(
      back +
        "message=" +
        encodeURIComponent(
          "Connexion impossible. Vérifiez vos identifiants et la confirmation de votre adresse.",
        ),
    );
  if (next) redirect(next);
  const { data: invitations } = await db
    .from("syndic_resident_invitations")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .is("revoked_at", null)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (invitations?.length) redirect("/resident");
  redirect(await landingFor(db));
}
export async function signUp(form: FormData) {
  const isSyndic = form.get("syndic") === "on";
  const next = safeNext(form.get("next"));
  const input = signUpSchema.safeParse({
    ...Object.fromEntries(form),
    organization: isSyndic ? form.get("organization") : "-",
    plan: isSyndic ? form.get("plan") : "essai",
  });
  const back =
    "/inscription?" +
    (isSyndic ? "syndic=1&" : "") +
    (next ? `next=${encodeURIComponent(next)}&` : "");
  if (!input.success || (isSyndic && input.data.organization.length < 2))
    message(
      back.slice(0, -1),
      isSyndic
        ? "Vérifiez vos informations et le nom de votre syndic."
        : "Vérifiez vos informations.",
    );
  const v = input.data;
  if (v.password !== String(form.get("confirmation") ?? ""))
    message(back.slice(0, -1), "Les mots de passe ne correspondent pas.");
  let created = false;
  try {
    const { provisionClient } = await import("@/lib/provision");
    const service = provisionClient();
    const { data, error } = await service.auth.admin.createUser({
      email: v.email,
      password: v.password,
      email_confirm: true,
      user_metadata: {
        first_name: v.first_name,
        last_name: v.last_name,
        phone: v.phone,
        nickname: v.first_name,
      },
    });
    created = !error && Boolean(data.user);
  } catch {}
  if (!created)
    message(
      back.slice(0, -1),
      "Création impossible. Cette adresse possède peut-être déjà un compte : connectez-vous.",
    );
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: v.email,
    password: v.password,
  });
  if (error) message("/connexion", "Votre compte est créé. Connectez-vous.");
  if (isSyndic) {
    const { error: requestError } = await db.rpc(
      "syndic_request_syndic_account",
      {
        organization: v.organization,
        plan_choice: v.plan,
        person_name: `${v.first_name} ${v.last_name}`,
        person_phone: v.phone,
      },
    );
    if (requestError)
      message("/en-attente", "Votre compte est créé, mais la demande syndic n’a pas pu être enregistrée. Réessayez ci-dessous.");
    redirect("/en-attente");
  }
  if (next) redirect(next);
  message("/resident", "Bienvenue ! Votre compte est créé.");
}
export async function requestSyndicAccount(form: FormData) {
  const { db, user } = await authenticated();
  const input = z
    .object({
      organization: z.string().trim().min(2).max(120),
      plan: z.enum(["essai", "standard", "entreprise"]),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ()-]{8,24}$/),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) message("/en-attente", "Vérifiez vos informations.");
  const meta = user.user_metadata ?? {};
  const name =
    `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim() ||
    user.email ||
    "Syndic";
  const { error } = await db.rpc("syndic_request_syndic_account", {
    organization: input.data.organization,
    plan_choice: input.data.plan,
    person_name: name,
    person_phone: input.data.phone,
  });
  message(
    "/en-attente",
    error
      ? "Demande impossible : une demande est déjà en cours ou votre compte est déjà syndic."
      : "Demande envoyée. Vous serez notifié après validation.",
  );
}
export async function signOut() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/connexion");
}
export async function resetPassword(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    message("/connexion", "Indiquez votre e-mail.");
  const db = await supabase();
  // The recovery email template must contain {{ .Token }} (see docs).
  await db.auth.resetPasswordForEmail(email);
  message(
    "/reinitialiser-mot-de-passe",
    "Si ce compte existe, un code de réinitialisation sera envoyé.",
  );
}
export async function resetPasswordWithCode(form: FormData) {
  const path = "/reinitialiser-mot-de-passe";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^[0-9]{6}$/.test(token))
    message(path, "Indiquez votre e-mail et le code à 6 chiffres.");
  if (password.length < 12 || password.length > 128)
    message(path, "Choisissez entre 12 et 128 caractères.");
  if (password !== String(form.get("confirmation") ?? ""))
    message(path, "Les mots de passe ne correspondent pas.");
  const db = await supabase();
  const { data, error } = await db.auth.verifyOtp({ email, token, type: "recovery" });
  if (error || !data.user || !data.session)
    message(path, "Code invalide ou expiré. Demandez un nouveau code.");
  const { error: updateError } = await db.auth.updateUser({ password });
  // Clear the recovery session; the next login uses the new password.
  await db.auth.signOut({ scope: "local" });
  if (updateError)
    message(path, "Impossible de modifier le mot de passe. Recommencez la réinitialisation.");
  message("/connexion", "Mot de passe mis à jour.");
}
export async function updatePassword(form: FormData) {
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 128)
    message("/app/mot-de-passe", "Choisissez entre 12 et 128 caractères.");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/connexion");
  const { error } = await db.auth.updateUser({ password });
  if (error)
    message(
      "/app/mot-de-passe",
      "Impossible de modifier le mot de passe. Recommencez la réinitialisation.",
    );
  message("/app", "Mot de passe mis à jour.");
}
async function authenticated() {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/connexion");
  return { db, user };
}
export async function createOrganization(form: FormData) {
  const parsed = organizationSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    message("/app", "Le nom doit contenir entre 2 et 120 caractères.");
  const { db } = await authenticated();
  const { error } = await db.rpc("syndic_create_organization", {
    organization_name: parsed.data.name,
  });
  if (error)
    message(
      "/app",
      "Création impossible. Vérifiez que la migration SyndiConnect est installée.",
    );
  revalidatePath("/app");
  message("/app", "Organisation créée. Ajoutez votre première résidence.");
}
export async function createResidence(form: FormData) {
  const parsed = residenceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    message(
      "/app/residences",
      "Vérifiez le nom, la ville, l’adresse et l’organisation.",
    );
  const { db } = await authenticated();
  const { error } = await db.from("syndic_residences").insert(parsed.data);
  if (error)
    message(
      "/app/residences",
      "Création refusée. Vérifiez vos droits sur cette organisation.",
    );
  revalidatePath("/app");
  message("/app/residences", "Résidence créée.");
}
export async function createUnit(form: FormData) {
  const parsed = unitSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    message(
      "/app/lots",
      "Vérifiez la résidence, le libellé et la quote-part positive.",
    );
  const { db } = await authenticated();
  const { error } = await db.from("syndic_units").insert(parsed.data);
  if (error)
    message(
      "/app/lots",
      "Création refusée : droits insuffisants ou libellé déjà utilisé dans cette résidence.",
    );
  revalidatePath("/app");
  message("/app/lots", "Lot créé.");
}
