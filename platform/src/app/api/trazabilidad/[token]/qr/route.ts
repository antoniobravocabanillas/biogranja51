import QRCode from "qrcode";
import { getPublicLotTraceability } from "@/lib/commerce-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const traceability = await getPublicLotTraceability(token);
    if (!traceability) {
      return Response.json({ error: "Lote no publicado." }, { status: 404 });
    }
    const publicUrl = new URL(`/trazabilidad/${token}`, request.url).toString();
    const svg = await QRCode.toString(publicUrl, {
      type: "svg",
      color: { dark: "#15452f", light: "#fffdf8" },
      margin: 2,
      width: 420,
      errorCorrectionLevel: "M",
    });
    return new Response(svg, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename="trazabilidad-${traceability.lotCode}.svg"`,
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  } catch {
    return Response.json({ error: "No se pudo generar el QR." }, { status: 400 });
  }
}
