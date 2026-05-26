import { requireAdminWrites } from "@/lib/admin-guard";
import { getAuditEvidence } from "@/lib/commerce-store";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const evidence = await getAuditEvidence(id);
    if (!evidence) {
      return Response.json({ error: "Evidencia no encontrada." }, { status: 404 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("audit-evidence")
      .createSignedUrl(evidence.storagePath, 60);
    if (error || !data?.signedUrl) {
      return Response.json({ error: "No se pudo generar el acceso temporal." }, { status: 400 });
    }
    return Response.redirect(data.signedUrl, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo descargar la evidencia.";
    return Response.json({ error: message }, { status: 400 });
  }
}
