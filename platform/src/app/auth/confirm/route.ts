import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["recovery"];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = request.nextUrl.searchParams.get("next");
  const next =
    nextParam?.startsWith("/gestion/") ? nextParam : "/gestion/restablecer";
  const destination = new URL(next, request.url);

  if (tokenHash && type && allowedTypes.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(destination);
    }
  }

  destination.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(destination);
}
