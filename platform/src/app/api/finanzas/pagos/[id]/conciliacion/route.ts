import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { reviewOrderPayment } from "@/lib/commerce-store";

type ReviewRequest = {
  status?: "reconciled" | "rejected";
  notes?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    const body = (await request.json()) as ReviewRequest;
    if (!body.status || !["reconciled", "rejected"].includes(body.status) || !body.notes?.trim()) {
      return Response.json({ error: "Registra resultado y sustento de conciliacion." }, { status: 400 });
    }
    await reviewOrderPayment({ paymentId: id, status: body.status, notes: body.notes.trim() });
    revalidatePath("/gestion/finanzas");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo conciliar el cobro.";
    return Response.json({ error: message }, { status: 400 });
  }
}
