import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: EmailOtpType[] = ["recovery", "signup", "email"];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const code = request.nextUrl.searchParams.get("code");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const nextParam = request.nextUrl.searchParams.get("next");
  const validNext =
    nextParam !== null &&
    (nextParam.startsWith("/gestion/") ||
      nextParam === "/mi-cuenta" ||
      nextParam.startsWith("/cuenta/") ||
      nextParam.startsWith("/reparto"));
  const next = validNext ? nextParam : "/gestion/restablecer";
  const destination = new URL(next, request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(destination);
    }
  }

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
