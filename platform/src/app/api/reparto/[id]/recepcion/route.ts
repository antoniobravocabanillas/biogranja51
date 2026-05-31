import { revalidatePath } from "next/cache";
import { completeMyDelivery } from "@/lib/commerce-store";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    await completeMyDelivery(id, {
      deliveredAt: body.deliveredAt,
      temperatureC: body.temperatureC,
      receivedBy: body.receivedBy.trim(),
      notes: body.notes?.trim() ?? "",
    });
    revalidatePath("/reparto");
    revalidatePath("/gestion");
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/auditoria");
    revalidatePath("/gestion/expedientes");
    revalidatePath("/mi-cuenta");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo confirmar la entrega.";
    return Response.json({ error: message }, { status: 400 });
  }
}
