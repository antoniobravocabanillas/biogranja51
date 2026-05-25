import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { approveFeedFormulaVersion } from "@/lib/commerce-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    await approveFeedFormulaVersion(id);
    revalidatePath("/gestion/molino");
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo aprobar la fórmula.";
    return Response.json({ error: message }, { status: 400 });
  }
}
