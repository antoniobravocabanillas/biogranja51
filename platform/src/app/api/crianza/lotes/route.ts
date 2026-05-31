import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { createBirdBatch } from "@/lib/commerce-store";

type BatchRequest = {
  locationId?: string;
  sourceName?: string;
  breed?: string | null;
  receivedAt?: string;
  initialCount?: number;
  initialAvgWeightGrams?: number | null;
  costPerChick?: number | null;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as BatchRequest;
    if (
      !body.locationId ||
      !body.sourceName?.trim() ||
      !body.receivedAt ||
      !Number.isInteger(body.initialCount) ||
      (body.initialCount ?? 0) <= 0
    ) {
      return Response.json(
        { error: "Completa proveedor, unidad productiva, fecha y cantidad de pollitos." },
        { status: 400 },
      );
    }
    if (
      body.initialAvgWeightGrams !== null &&
      body.initialAvgWeightGrams !== undefined &&
      (!Number.isFinite(body.initialAvgWeightGrams) || body.initialAvgWeightGrams <= 0)
    ) {
      return Response.json({ error: "El peso inicial no es válido." }, { status: 400 });
    }
    if (
      body.costPerChick !== null &&
      body.costPerChick !== undefined &&
      (!Number.isFinite(body.costPerChick) || body.costPerChick < 0)
    ) {
      return Response.json({ error: "El costo por pollito no es válido." }, { status: 400 });
    }

    await createBirdBatch({
      locationId: body.locationId,
      sourceName: body.sourceName.trim(),
      breed: body.breed?.trim() || null,
      receivedAt: body.receivedAt,
      initialCount: body.initialCount!,
      initialAvgWeightGrams: body.initialAvgWeightGrams ?? null,
      costPerChick: body.costPerChick ?? null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/crianza");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la crianza.";
    return Response.json({ error: message }, { status: 400 });
  }
}
