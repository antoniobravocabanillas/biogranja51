import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { recordInventoryMovement } from "@/lib/commerce-store";

type MovementRequest = {
  type?: "adjustment_in" | "waste";
  quantity?: number;
  reason?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as MovementRequest;
    if (
      (body.type !== "adjustment_in" && body.type !== "waste") ||
      !Number.isFinite(body.quantity) ||
      (body.quantity ?? 0) <= 0 ||
      !body.reason?.trim()
    ) {
      return Response.json({ error: "Indica movimiento, cantidad y motivo." }, { status: 400 });
    }
    await recordInventoryMovement({
      lotId: id,
      type: body.type,
      quantity: body.quantity!,
      reason: body.reason.trim(),
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/inventario");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el movimiento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
