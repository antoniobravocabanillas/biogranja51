import { revalidatePath } from "next/cache";
import { isBirdBatchStage, type BirdBatchStage } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { recordBirdBatchEvent } from "@/lib/commerce-store";

type EventRequest = {
  type?: "mortality" | "weight_sample" | "feed_consumption" | "stage_change";
  eventAt?: string;
  count?: number | null;
  avgWeightGrams?: number | null;
  feedKg?: number | null;
  stage?: BirdBatchStage | null;
  notes?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as EventRequest;
    if (
      !body.eventAt ||
      !["mortality", "weight_sample", "feed_consumption", "stage_change"].includes(body.type ?? "")
    ) {
      return Response.json({ error: "Selecciona el tipo y la fecha del registro." }, { status: 400 });
    }
    if (body.type === "mortality" && (!Number.isInteger(body.count) || (body.count ?? 0) <= 0)) {
      return Response.json({ error: "Indica la cantidad de mortalidad." }, { status: 400 });
    }
    if (body.type === "weight_sample" && (!body.avgWeightGrams || body.avgWeightGrams <= 0)) {
      return Response.json({ error: "Indica el peso promedio de la muestra." }, { status: 400 });
    }
    if (body.type === "feed_consumption" && (!body.feedKg || body.feedKg <= 0)) {
      return Response.json({ error: "Indica los kilos de alimento consumidos." }, { status: 400 });
    }
    if (body.type === "stage_change" && !isBirdBatchStage(body.stage)) {
      return Response.json({ error: "Selecciona la nueva etapa." }, { status: 400 });
    }

    await recordBirdBatchEvent({
      batchId: id,
      type: body.type!,
      eventAt: body.eventAt,
      count: body.type === "mortality" ? body.count! : null,
      avgWeightGrams: body.type === "weight_sample" ? body.avgWeightGrams! : null,
      feedKg: body.type === "feed_consumption" ? body.feedKg! : null,
      stage: body.type === "stage_change" ? body.stage! : null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/crianza");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el seguimiento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
