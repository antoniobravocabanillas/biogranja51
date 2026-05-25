import { revalidatePath } from "next/cache";
import { millBatchUsageLabels, type MillBatchUsage } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { createMillBatch } from "@/lib/commerce-store";

type BatchRequest = {
  versionId?: string;
  locationId?: string;
  usage?: MillBatchUsage;
  producedKg?: number;
  producedAt?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as BatchRequest;
    if (
      !body.versionId ||
      !body.locationId ||
      !body.producedAt ||
      !body.usage ||
      !(body.usage in millBatchUsageLabels) ||
      !Number.isFinite(body.producedKg) ||
      (body.producedKg ?? 0) <= 0
    ) {
      return Response.json({ error: "Completa fórmula aprobada, destino, cantidad y fecha." }, { status: 400 });
    }
    await createMillBatch({
      versionId: body.versionId,
      locationId: body.locationId,
      usage: body.usage,
      producedKg: body.producedKg!,
      producedAt: body.producedAt,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/molino");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo producir el alimento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
