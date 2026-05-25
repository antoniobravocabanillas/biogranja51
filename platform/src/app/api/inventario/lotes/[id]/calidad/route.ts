import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { reviewInventoryLotSanitary } from "@/lib/commerce-store";

type SanitaryRequest = {
  sanitaryStatus?: "approved" | "rejected";
  sanitaryNotes?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = (await request.json()) as SanitaryRequest;
    if (!body.sanitaryStatus || !["approved", "rejected"].includes(body.sanitaryStatus)) {
      return Response.json({ error: "Selecciona liberar o rechazar el lote." }, { status: 400 });
    }
    if (!body.sanitaryNotes?.trim()) {
      return Response.json({ error: "Documenta la revision sanitaria." }, { status: 400 });
    }
    await reviewInventoryLotSanitary({
      lotId: id,
      sanitaryStatus: body.sanitaryStatus,
      sanitaryNotes: body.sanitaryNotes.trim(),
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/inventario");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la revision sanitaria.";
    return Response.json({ error: message }, { status: 400 });
  }
}
