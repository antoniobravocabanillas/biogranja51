import { getDeliveryPortalWorkspace } from "@/lib/commerce-store";

export async function GET() {
  try {
    return Response.json(await getDeliveryPortalWorkspace());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer tus entregas.";
    return Response.json({ error: message }, { status: 401 });
  }
}
