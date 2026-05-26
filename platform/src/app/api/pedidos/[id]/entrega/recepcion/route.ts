import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { completeOrderDelivery } from "@/lib/commerce-store";

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
    const body = (await request.json()) as {
      deliveredAt?: string;
      temperatureC?: number;
      receivedBy?: string;
      notes?: string;
    };
    if (!body.deliveredAt || typeof body.temperatureC !== "number" || !body.receivedBy?.trim()) {
      return Response.json({ error: "Registra hora, temperatura y receptor del pedido." }, { status: 400 });
    }
    const updated = await completeOrderDelivery(id, {
      deliveredAt: body.deliveredAt,
      temperatureC: body.temperatureC,
      receivedBy: body.receivedBy.trim(),
      notes: body.notes?.trim() ?? "",
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/auditoria");
    revalidatePath("/gestion/expedientes");
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo confirmar la entrega.";
    return Response.json({ error: message }, { status: 400 });
  }
}
