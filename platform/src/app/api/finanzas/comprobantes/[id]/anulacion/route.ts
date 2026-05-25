import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { voidSalesReceipt } from "@/lib/commerce-store";

type VoidRequest = {
  reason?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const body = (await request.json()) as VoidRequest;
    if (!body.reason?.trim()) {
      return Response.json({ error: "Documenta el motivo de anulacion." }, { status: 400 });
    }
    await voidSalesReceipt({ receiptId: id, reason: body.reason.trim() });
    revalidatePath("/gestion/finanzas");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo anular el comprobante.";
    return Response.json({ error: message }, { status: 400 });
  }
}
