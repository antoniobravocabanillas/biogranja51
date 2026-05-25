import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { allocateLotToOrderItem } from "@/lib/commerce-store";

type AllocationRequest = {
  orderItemId?: string;
  lotId?: string;
  quantity?: number;
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as AllocationRequest;
    if (
      !body.orderItemId ||
      !body.lotId ||
      !Number.isFinite(body.quantity) ||
      (body.quantity ?? 0) <= 0
    ) {
      return Response.json({ error: "Selecciona lote y cantidad para asignar." }, { status: 400 });
    }
    await allocateLotToOrderItem({
      orderItemId: body.orderItemId,
      lotId: body.lotId,
      quantity: body.quantity!,
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/inventario");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo asignar el lote.";
    return Response.json({ error: message }, { status: 400 });
  }
}
