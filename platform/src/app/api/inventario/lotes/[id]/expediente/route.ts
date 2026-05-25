import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { recordInventorySanitaryEvidence } from "@/lib/commerce-store";

type EvidenceRequest = {
  supplierDocument?: string;
  supplierLotCode?: string;
  arrivalTemperatureC?: number;
  storageTemperatureC?: number;
  packagingCondition?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    const body = (await request.json()) as EvidenceRequest;
    if (
      !body.supplierDocument?.trim() ||
      !body.supplierLotCode?.trim() ||
      !body.packagingCondition?.trim() ||
      !Number.isFinite(body.arrivalTemperatureC) ||
      !Number.isFinite(body.storageTemperatureC)
    ) {
      return Response.json({ error: "Completa documento, lote, temperaturas y empaque." }, { status: 400 });
    }
    await recordInventorySanitaryEvidence({
      lotId: id,
      supplierDocument: body.supplierDocument.trim(),
      supplierLotCode: body.supplierLotCode.trim(),
      arrivalTemperatureC: body.arrivalTemperatureC!,
      storageTemperatureC: body.storageTemperatureC!,
      packagingCondition: body.packagingCondition.trim(),
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/inventario");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el expediente.";
    return Response.json({ error: message }, { status: 400 });
  }
}
