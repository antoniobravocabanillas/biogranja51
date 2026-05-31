import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { harvestBirdBatch } from "@/lib/commerce-store";

type HarvestRequest = {
  productId?: string;
  locationId?: string;
  processedUnits?: number;
  netWeightKg?: number;
  unitCost?: number | null;
  processedAt?: string;
  expiresAt?: string | null;
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
    const body = (await request.json()) as HarvestRequest;
    if (
      !body.productId ||
      !body.locationId ||
      !body.processedAt ||
      !Number.isInteger(body.processedUnits) ||
      (body.processedUnits ?? 0) <= 0 ||
      !Number.isFinite(body.netWeightKg) ||
      (body.netWeightKg ?? 0) <= 0
    ) {
      return Response.json(
        { error: "Completa pollos faenados, peso neto, producto, sede y fecha." },
        { status: 400 },
      );
    }
    if (
      body.unitCost !== null &&
      body.unitCost !== undefined &&
      (!Number.isFinite(body.unitCost) || body.unitCost < 0)
    ) {
      return Response.json({ error: "El costo por kg no es válido." }, { status: 400 });
    }
    await harvestBirdBatch({
      batchId: id,
      productId: body.productId,
      locationId: body.locationId,
      processedUnits: body.processedUnits!,
      netWeightKg: body.netWeightKg!,
      unitCost: body.unitCost ?? null,
      processedAt: body.processedAt,
      expiresAt: body.expiresAt || null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/crianza");
    revalidatePath("/gestion/inventario");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo generar el lote faenado.";
    return Response.json({ error: message }, { status: 400 });
  }
}
