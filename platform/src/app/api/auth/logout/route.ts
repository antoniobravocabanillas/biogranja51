import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  const formData = await request.formData().catch(() => null);
  const requestedNext = formData?.get("next");
  const next = requestedNext === "/cuenta" ? "/cuenta" : "/gestion/login";

  return NextResponse.redirect(new URL(next, request.url), {
    status: 303,
  });
}
