import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { voidAuditEvidence } from "@/lib/commerce-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const body = (await request.json()) as { reason?: string };
    if (!body.reason?.trim()) {
      return Response.json({ error: "Documenta el motivo de anulacion." }, { status: 400 });
    }
    await voidAuditEvidence({ evidenceId: id, reason: body.reason.trim() });
    revalidatePath("/gestion/expedientes");
    revalidatePath("/gestion/expedientes/reporte");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo anular la evidencia.";
    return Response.json({ error: message }, { status: 400 });
  }
}
