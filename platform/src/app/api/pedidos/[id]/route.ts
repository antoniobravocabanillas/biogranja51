import { revalidatePath } from "next/cache";
import { isOrderStatus, orderStatusActions, type OrderStatus } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { getCommerceState, updateOrder } from "@/lib/commerce-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: OrderStatus };
    if (!isOrderStatus(body.status)) {
      return Response.json({ error: "El estado indicado no es válido." }, { status: 400 });
    }

    const state = await getCommerceState();
    const current = state.orders.find((order) => order.id === id);
    if (!current) {
      return Response.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const nextStatuses = orderStatusActions[current.status] ?? [];
    if (!nextStatuses.includes(body.status)) {
      return Response.json(
        { error: "La transición de estado no está permitida." },
        { status: 409 },
      );
    }
    if (body.status === "dispatched" || body.status === "delivered") {
      return Response.json(
        { error: "Registra despacho y recepcion desde el control de entrega." },
        { status: 409 },
      );
    }

    const updated = await updateOrder(id, { status: body.status });
    revalidatePath("/gestion");
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/auditoria");
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el pedido.";
    return Response.json({ error: message }, { status: 400 });
  }
}
