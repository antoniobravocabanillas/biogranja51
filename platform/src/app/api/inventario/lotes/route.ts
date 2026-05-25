import { revalidatePath } from "next/cache";
import { isInventoryUnit, type InventoryUnit } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { createInventoryLot } from "@/lib/commerce-store";

type LotRequest = {
  productId?: string;
  locationId?: string;
  quantity?: number;
  unit?: InventoryUnit;
  unitCost?: number | null;
  receivedAt?: string;
  expiresAt?: string | null;
  supplierName?: string | null;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as LotRequest;
    if (
      !body.productId ||
      !body.locationId ||
      !isInventoryUnit(body.unit) ||
      !Number.isFinite(body.quantity) ||
      (body.quantity ?? 0) <= 0 ||
      !body.receivedAt
    ) {
      return Response.json({ error: "Completa producto, sede, cantidad, unidad y fecha." }, { status: 400 });
    }
    if (
      body.unitCost !== null &&
      body.unitCost !== undefined &&
      (!Number.isFinite(body.unitCost) || body.unitCost < 0)
    ) {
      return Response.json({ error: "El costo del lote no es válido." }, { status: 400 });
    }

    await createInventoryLot({
      productId: body.productId,
      locationId: body.locationId,
      quantity: body.quantity!,
      unit: body.unit,
      unitCost: body.unitCost ?? null,
      receivedAt: body.receivedAt,
      expiresAt: body.expiresAt || null,
      supplierName: body.supplierName?.trim() || null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/inventario");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el lote.";
    return Response.json({ error: message }, { status: 400 });
  }
}
