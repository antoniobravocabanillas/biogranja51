import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { valueBirdBatchFeedEvent } from "@/lib/commerce-store";

type ValuationRequest = {
  feedUnitCost?: number;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; eventId: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id, eventId } = await params;
    const body = (await request.json()) as ValuationRequest;
    if (body.feedUnitCost === undefined || body.feedUnitCost < 0) {
      return Response.json({ error: "Indica el costo por kg del alimento." }, { status: 400 });
    }
    await valueBirdBatchFeedEvent({
      batchId: id,
      eventId,
      feedUnitCost: body.feedUnitCost,
    });
    revalidatePath("/gestion/crianza");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo valorizar el consumo.";
    return Response.json({ error: message }, { status: 400 });
  }
}
