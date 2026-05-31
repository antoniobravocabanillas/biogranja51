import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { publishInventoryLotTraceability } from "@/lib/commerce-store";

type TraceabilityRequest = {
  published?: boolean;
  publicSummary?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const body = (await request.json()) as TraceabilityRequest;
    if (typeof body.published !== "boolean") {
      return Response.json({ error: "Selecciona si el lote se publica o se oculta." }, { status: 400 });
    }
    if (body.published && (body.publicSummary?.trim().length ?? 0) < 12) {
      return Response.json({ error: "Incluye una descripcion publica breve del lote." }, { status: 400 });
    }
    await publishInventoryLotTraceability({
      lotId: id,
      published: body.published,
      publicSummary: body.publicSummary?.trim() ?? "",
    });
    revalidatePath("/gestion/inventario");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo publicar la trazabilidad.";
    return Response.json({ error: message }, { status: 400 });
  }
}
