import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { createLayerFlock } from "@/lib/commerce-store";

type FlockRequest = {
  locationId?: string;
  sourceName?: string;
  breed?: string | null;
  startedAt?: string;
  initialHens?: number;
  costPerHen?: number | null;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }
  try {
    const body = (await request.json()) as FlockRequest;
    if (
      !body.locationId ||
      !body.sourceName?.trim() ||
      !body.startedAt ||
      !Number.isInteger(body.initialHens) ||
      (body.initialHens ?? 0) <= 0
    ) {
      return Response.json(
        { error: "Completa origen, unidad productiva, fecha y cantidad de ponedoras." },
        { status: 400 },
      );
    }
    if (
      body.costPerHen !== null &&
      body.costPerHen !== undefined &&
      (!Number.isFinite(body.costPerHen) || body.costPerHen < 0)
    ) {
      return Response.json({ error: "El costo por ponedora no es válido." }, { status: 400 });
    }
    await createLayerFlock({
      locationId: body.locationId,
      sourceName: body.sourceName.trim(),
      breed: body.breed?.trim() || null,
      startedAt: body.startedAt,
      initialHens: body.initialHens!,
      costPerHen: body.costPerHen ?? null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/huevos");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el lote de ponedoras.";
    return Response.json({ error: message }, { status: 400 });
  }
}
