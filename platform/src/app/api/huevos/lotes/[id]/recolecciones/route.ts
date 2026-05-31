import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { collectEggs } from "@/lib/commerce-store";

type CollectionRequest = {
  collectedAt?: string;
  collectedEggs?: number;
  rejectedEggs?: number;
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
    const body = (await request.json()) as CollectionRequest;
    if (
      !body.collectedAt ||
      !Number.isInteger(body.collectedEggs) ||
      (body.collectedEggs ?? 0) <= 0 ||
      !Number.isInteger(body.rejectedEggs ?? 0) ||
      (body.rejectedEggs ?? 0) < 0 ||
      (body.rejectedEggs ?? 0) > (body.collectedEggs ?? 0)
    ) {
      return Response.json({ error: "Registra huevos recolectados y descarte válido." }, { status: 400 });
    }
    await collectEggs({
      flockId: id,
      collectedAt: body.collectedAt,
      collectedEggs: body.collectedEggs!,
      rejectedEggs: body.rejectedEggs ?? 0,
      notes: body.notes?.trim() || "",
    });
    revalidatePath("/gestion/huevos");
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la recolección.";
    return Response.json({ error: message }, { status: 400 });
  }
}
