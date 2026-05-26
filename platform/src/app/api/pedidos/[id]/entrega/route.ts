import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { scheduleOrderDelivery } from "@/lib/commerce-store";

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
    const body = (await request.json()) as {
      windowStart?: string;
      windowEnd?: string;
      driverName?: string;
      vehicleReference?: string;
      planningNotes?: string;
    };
    if (!body.windowStart || !body.windowEnd || !body.driverName?.trim()) {
      return Response.json({ error: "Completa ventana y responsable de entrega." }, { status: 400 });
    }
    const updated = await scheduleOrderDelivery(id, {
      windowStart: body.windowStart,
      windowEnd: body.windowEnd,
      driverName: body.driverName.trim(),
      vehicleReference: body.vehicleReference?.trim() ?? "",
      planningNotes: body.planningNotes?.trim() ?? "",
    });
    revalidatePath("/gestion/pedidos");
    revalidatePath("/gestion/auditoria");
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo programar la entrega.";
    return Response.json({ error: message }, { status: 400 });
  }
}
