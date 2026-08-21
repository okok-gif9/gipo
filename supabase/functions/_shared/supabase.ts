import { createClient } from "npm:@supabase/supabase-js@2";

export function publishableKey() {
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  return keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_ANON_KEY")!;
}

export function clientFor(authorization: string) {
  return createClient(Deno.env.get("SUPABASE_URL")!, publishableKey(), { global: { headers: { Authorization: authorization } } });
}

export function serviceClient() {
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("SERVER_MISCONFIGURED");
  return createClient(Deno.env.get("SUPABASE_URL")!, key);
}
