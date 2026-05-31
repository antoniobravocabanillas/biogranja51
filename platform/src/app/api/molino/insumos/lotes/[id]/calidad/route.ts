import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { reviewFeedInputLot } from "@/lib/commerce-store";

type QualityRequest = {
  qualityStatus?: "approved" | "rejected";
  qualityNotes?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = (await request.json()) as QualityRequest;
    if (!body.qualityStatus || !["approved", "rejected"].includes(body.qualityStatus)) {
      return Response.json({ error: "Selecciona aprobar o rechazar el insumo." }, { status: 400 });
    }
    await reviewFeedInputLot({
      lotId: id,
      qualityStatus: body.qualityStatus,
      qualityNotes: body.qualityNotes?.trim() || "",
    });
    revalidatePath("/gestion/molino");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar calidad.";
    return Response.json({ error: message }, { status: 400 });
  }
}
