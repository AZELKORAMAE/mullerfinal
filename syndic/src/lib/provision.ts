import "server-only";
import { createClient } from "@supabase/supabase-js";
export function provisionClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Provisioning not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
