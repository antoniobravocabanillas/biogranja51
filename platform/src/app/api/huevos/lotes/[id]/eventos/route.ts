import { revalidatePath } from "next/cache";
import { poultryExpenseCategories, type LayerEventType, type PoultryExpenseCategory } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { recordLayerFlockEvent } from "@/lib/commerce-store";

type EventRequest = {
  type?: LayerEventType;
  eventAt?: string;
  count?: number | null;
  feedKg?: number | null;
  feedUnitCost?: number | null;
  amount?: number | null;
  expenseCategory?: PoultryExpenseCategory | null;
  millBatchId?: string | null;
  notes?: string;
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
    const body = (await request.json()) as EventRequest;
    if (!body.eventAt || !["mortality", "feed_consumption", "expense"].includes(body.type ?? "")) {
      return Response.json({ error: "Selecciona el tipo y la fecha del registro." }, { status: 400 });
    }
    if (body.type === "mortality" && (!Number.isInteger(body.count) || (body.count ?? 0) <= 0)) {
      return Response.json({ error: "Indica la mortalidad registrada." }, { status: 400 });
    }
    if (body.type === "feed_consumption" && (!body.feedKg || body.feedKg <= 0)) {
      return Response.json({ error: "Indica los kilos de alimento consumidos." }, { status: 400 });
    }
    if (
      body.type === "feed_consumption" &&
      !body.millBatchId &&
      (body.feedUnitCost === null ||
        body.feedUnitCost === undefined ||
        !Number.isFinite(body.feedUnitCost) ||
        body.feedUnitCost < 0)
    ) {
      return Response.json({ error: "Registra el costo por kg del alimento." }, { status: 400 });
    }
    if (
      body.type === "expense" &&
      (!body.amount ||
        body.amount <= 0 ||
        !poultryExpenseCategories.includes(body.expenseCategory as PoultryExpenseCategory))
    ) {
      return Response.json({ error: "Indica la categoría y el monto del costo." }, { status: 400 });
    }
    await recordLayerFlockEvent({
      flockId: id,
      type: body.type!,
      eventAt: body.eventAt,
      count: body.type === "mortality" ? body.count! : null,
      feedKg: body.type === "feed_consumption" ? body.feedKg! : null,
      feedUnitCost: body.type === "feed_consumption" ? body.feedUnitCost! : null,
      amount: body.type === "expense" ? body.amount! : null,
      expenseCategory: body.type === "expense" ? body.expenseCategory! : null,
      millBatchId: body.type === "feed_consumption" ? body.millBatchId ?? null : null,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/huevos");
    revalidatePath("/gestion/auditoria");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar el seguimiento.";
    return Response.json({ error: message }, { status: 400 });
  }
}
