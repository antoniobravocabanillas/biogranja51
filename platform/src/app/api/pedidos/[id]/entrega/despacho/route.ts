import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { dispatchOrderDelivery } from "@/lib/commerce-store";

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
      dispatchedAt?: string;
      temperatureC?: number;
      packagingCondition?: string;
    };
    if (
      !body.dispatchedAt ||
      typeof body.temperatureC !== "number" ||
      !body.packagingCondition?.trim()
    ) {
      return Response.json({ error: "Registra hora, temperatura y empaque de salida." }, { status: 400 });
    }
    const updated = await dispatchOrderDelivery(id, {
      dispatchedAt: body.dispatchedAt,
      temperatureC: body.temperatureC,
      packagingCondition: body.packagingCondition.trim(),
    });
    revalidatePath("/gestion");
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/auditoria");
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo despachar la entrega.";
    return Response.json({ error: message }, { status: 400 });
  }
}
