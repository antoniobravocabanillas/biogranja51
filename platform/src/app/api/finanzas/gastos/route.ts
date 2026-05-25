import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { recordOrderExpense } from "@/lib/commerce-store";

type ExpenseRequest = {
  orderId?: string;
  category?: "delivery" | "packaging" | "commission" | "other";
  amount?: number;
  incurredAt?: string;
  reference?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as ExpenseRequest;
    if (
      !body.orderId ||
      !body.category ||
      !["delivery", "packaging", "commission", "other"].includes(body.category) ||
      !Number.isFinite(body.amount) ||
      (body.amount ?? 0) <= 0 ||
      !body.incurredAt ||
      !body.reference?.trim()
    ) {
      return Response.json({ error: "Completa categoria, importe, fecha y sustento del gasto." }, { status: 400 });
    }
    await recordOrderExpense({
      orderId: body.orderId,
      category: body.category,
      amount: body.amount!,
      incurredAt: body.incurredAt,
      reference: body.reference.trim(),
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/finanzas");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el gasto.";
    return Response.json({ error: message }, { status: 400 });
  }
}
