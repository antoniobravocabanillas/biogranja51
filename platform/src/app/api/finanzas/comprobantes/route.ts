import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { issueSalesReceipt } from "@/lib/commerce-store";

type ReceiptRequest = {
  orderId?: string;
  type?: "boleta" | "factura";
  seriesNumber?: string;
  customerDocument?: string | null;
  issuedAt?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as ReceiptRequest;
    if (
      !body.orderId ||
      !body.type ||
      !["boleta", "factura"].includes(body.type) ||
      !body.seriesNumber?.trim() ||
      !body.issuedAt
    ) {
      return Response.json({ error: "Completa tipo, numero y fecha del comprobante." }, { status: 400 });
    }
    if (body.type === "factura" && !body.customerDocument?.trim()) {
      return Response.json({ error: "La factura requiere RUC del cliente." }, { status: 400 });
    }
    await issueSalesReceipt({
      orderId: body.orderId,
      type: body.type,
      seriesNumber: body.seriesNumber.trim(),
      customerDocument: body.customerDocument?.trim() || null,
      issuedAt: body.issuedAt,
    });
    revalidatePath("/gestion/finanzas");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el comprobante.";
    return Response.json({ error: message }, { status: 400 });
  }
}
