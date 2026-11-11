import { supabase } from "@/lib/supabase/server";
export async function workspace() {
  const db = await supabase();
  const [organizations, residences, units] = await Promise.all([
    db.from("syndic_organizations").select("id,name").order("created_at"),
    db
      .from("syndic_residences")
      .select("id,name,address,city,organization_id")
      .order("created_at"),
    db
      .from("syndic_units")
      .select("id,label,kind,share,residence_id")
      .order("created_at"),
  ]);
  return {
    organizations: organizations.data ?? [],
    residences: residences.data ?? [],
    units: units.data ?? [],
    error: Boolean(organizations.error || residences.error || units.error),
  };
}
