import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { createFeedFormulaVersion } from "@/lib/commerce-store";

type VersionRequest = {
  targetKg?: number;
  notes?: string;
  items?: Array<{ inputId?: string; quantityKg?: number }>;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = (await request.json()) as VersionRequest;
    const validItems = (body.items ?? []).filter(
      (item): item is { inputId: string; quantityKg: number } =>
        Boolean(item.inputId) && Number.isFinite(item.quantityKg) && (item.quantityKg ?? 0) >= 0,
    );
    if (
      !Number.isFinite(body.targetKg) ||
      (body.targetKg ?? 0) <= 0 ||
      !validItems.length ||
      validItems.length !== (body.items ?? []).length
    ) {
      return Response.json({ error: "Completa el lote objetivo y cantidades válidas." }, { status: 400 });
    }
    await createFeedFormulaVersion({
      formulaId: id,
      targetKg: body.targetKg!,
      notes: body.notes?.trim() || "",
      items: validItems,
    });
    revalidatePath("/gestion/molino");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo versionar la fórmula.";
    return Response.json({ error: message }, { status: 400 });
  }
}
