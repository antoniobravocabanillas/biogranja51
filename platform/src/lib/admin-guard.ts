import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

async function hasStaffSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return process.env.NODE_ENV !== "production" || process.env.ADMIN_READ_ENABLED === "true";
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return false;
  }

  const { data: assignment } = await supabase
    .from("staff_assignments")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  return Boolean(assignment);
}

export async function managementAccessIsEnabled(): Promise<boolean> {
  return hasStaffSession();
}

export async function writesAreEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return process.env.NODE_ENV !== "production" || process.env.ADMIN_WRITE_ENABLED === "true";
  }
  return hasStaffSession();
}

export async function protectedReadsAreEnabled(): Promise<boolean> {
  return hasStaffSession();
}

export async function requireAdminWrites(): Promise<Response | null> {
  if (await writesAreEnabled()) {
    return null;
  }

  return Response.json(
    {
      error: isSupabaseConfigured()
        ? "Inicia sesión con un usuario asignado al equipo BioGranja 51."
        : "Las escrituras administrativas requieren autenticación en producción.",
    },
    { status: 403 },
  );
}
