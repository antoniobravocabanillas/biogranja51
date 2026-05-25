import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { registerFeedInputPrice } from "@/lib/commerce-store";

type PriceRequest = {
  costPerKg?: number;
  effectiveAt?: string;
  supplierName?: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = (await request.json()) as PriceRequest;
    if (
      !body.effectiveAt ||
      !Number.isFinite(body.costPerKg) ||
      (body.costPerKg ?? -1) < 0
    ) {
      return Response.json({ error: "Registra fecha y costo válido por kg." }, { status: 400 });
    }
    await registerFeedInputPrice({
      inputId: id,
      costPerKg: body.costPerKg!,
      effectiveAt: body.effectiveAt,
      supplierName: body.supplierName?.trim() || null,
    });
    revalidatePath("/gestion/molino");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el precio.";
    return Response.json({ error: message }, { status: 400 });
  }
}
