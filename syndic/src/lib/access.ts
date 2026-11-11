import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
export async function signedIn() {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/connexion");
  return { db, user };
}
export async function platformAdmin() {
  const { db, user } = await signedIn();
  const { data, error } = await db.rpc("syndic_is_platform_admin");
  if (error || data !== true) redirect("/acces-refuse");
  return { db, user };
}
