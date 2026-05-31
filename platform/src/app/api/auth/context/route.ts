import { getAccountContext } from "@/lib/commerce-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return Response.json({ accountType: "staff", destination: "/gestion" });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return Response.json({ accountType: "unknown", destination: "/cuenta" });
  }

  return Response.json(await getAccountContext());
}
