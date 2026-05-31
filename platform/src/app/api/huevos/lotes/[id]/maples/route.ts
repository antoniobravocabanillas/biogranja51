import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { packEggMaples } from "@/lib/commerce-store";

type PackRequest = {
  productId?: string;
  locationId?: string;
  mapleCount?: number;
  unitCost?: number | null;
  packedAt?: string;
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
    const body = (await request.json()) as PackRequest;
    if (
      !body.productId ||
      !body.locationId ||
      !body.packedAt ||
      !Number.isInteger(body.mapleCount) ||
      (body.mapleCount ?? 0) <= 0
    ) {
      return Response.json({ error: "Completa producto, sede, fecha y cantidad de maples." }, { status: 400 });
    }
    if (
      body.unitCost !== null &&
      body.unitCost !== undefined &&
      (!Number.isFinite(body.unitCost) || body.unitCost < 0)
    ) {
      return Response.json({ error: "El costo por maple no es válido." }, { status: 400 });
    }
    await packEggMaples({
      flockId: id,
      productId: body.productId,
      locationId: body.locationId,
      mapleCount: body.mapleCount!,
      unitCost: body.unitCost ?? null,
      packedAt: body.packedAt,
      expiresAt: body.expiresAt || null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/huevos");
    revalidatePath("/gestion/inventario");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo empacar maples.";
    return Response.json({ error: message }, { status: 400 });
  }
}
