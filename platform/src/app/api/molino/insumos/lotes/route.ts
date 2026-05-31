import { revalidatePath } from "next/cache";
import { type FeedInputQualityStatus } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { receiveFeedInputLot } from "@/lib/commerce-store";

type ReceiptRequest = {
  inputId?: string;
  locationId?: string;
  supplierName?: string;
  supplierTaxId?: string | null;
  quantityKg?: number;
  unitCost?: number;
  receivedAt?: string;
  documentReference?: string;
  qualityStatus?: FeedInputQualityStatus;
  qualityNotes?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as ReceiptRequest;
    if (
      !body.inputId ||
      !body.locationId ||
      !body.receivedAt ||
      !body.supplierName?.trim() ||
      !body.documentReference?.trim() ||
      !Number.isFinite(body.quantityKg) ||
      (body.quantityKg ?? 0) <= 0 ||
      !Number.isFinite(body.unitCost) ||
      (body.unitCost ?? -1) < 0 ||
      !["pending", "approved", "rejected"].includes(body.qualityStatus ?? "")
    ) {
      return Response.json(
        { error: "Completa insumo, proveedor, documento, cantidad, costo y control de calidad." },
        { status: 400 },
      );
    }
    await receiveFeedInputLot({
      inputId: body.inputId,
      locationId: body.locationId,
      supplierName: body.supplierName.trim(),
      supplierTaxId: body.supplierTaxId?.trim() || null,
      quantityKg: body.quantityKg!,
      unitCost: body.unitCost!,
      receivedAt: body.receivedAt,
      documentReference: body.documentReference.trim(),
      qualityStatus: body.qualityStatus!,
      qualityNotes: body.qualityNotes?.trim() || "",
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/molino");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo recibir el insumo.";
    return Response.json({ error: message }, { status: 400 });
  }
}
