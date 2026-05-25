import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { registerOrderPayment } from "@/lib/commerce-store";

type PaymentRequest = {
  orderId?: string;
  paymentMethodId?: string;
  amount?: number;
  paidAt?: string;
  operationReference?: string;
  evidenceReference?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as PaymentRequest;
    if (
      !body.orderId ||
      !body.paymentMethodId ||
      !Number.isFinite(body.amount) ||
      (body.amount ?? 0) <= 0 ||
      !body.paidAt ||
      !body.operationReference?.trim()
    ) {
      return Response.json(
        { error: "Completa pedido, medio, importe, fecha y numero de operacion." },
        { status: 400 },
      );
    }
    await registerOrderPayment({
      orderId: body.orderId,
      paymentMethodId: body.paymentMethodId,
      amount: body.amount!,
      paidAt: body.paidAt,
      operationReference: body.operationReference.trim(),
      evidenceReference: body.evidenceReference?.trim() || "",
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/finanzas");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el cobro.";
    return Response.json({ error: message }, { status: 400 });
  }
}
