import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminWrites } from "@/lib/admin-guard";
import { registerAuditEvidence } from "@/lib/commerce-store";
import type { EvidenceCategory, EvidenceEntityType } from "@/domain/commerce";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const entityTypes: EvidenceEntityType[] = [
  "inventory_lot",
  "bird_batch",
  "layer_flock",
  "feed_input_lot",
  "mill_batch",
  "order",
  "order_payment",
  "sales_receipt",
];
const categories: EvidenceCategory[] = [
  "supplier_document",
  "temperature_record",
  "sanitary_release",
  "payment_proof",
  "sales_receipt",
  "delivery_proof",
  "production_record",
  "other",
];

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return Response.json(
      { error: "El almacenamiento privado de expedientes requiere Supabase activo." },
      { status: 503 },
    );
  }

  const body = await request.formData();
  const file = body.get("file");
  const entityType = String(body.get("entityType") ?? "") as EvidenceEntityType;
  const entityId = String(body.get("entityId") ?? "");
  const category = String(body.get("category") ?? "") as EvidenceCategory;
  const title = String(body.get("title") ?? "").trim();
  const notes = String(body.get("notes") ?? "").trim();

  if (!(file instanceof File)) {
    return Response.json({ error: "Selecciona un archivo de evidencia." }, { status: 400 });
  }
  if (!entityTypes.includes(entityType) || !entityId || !categories.includes(category) || title.length < 3) {
    return Response.json({ error: "Selecciona el expediente, categoria y titulo." }, { status: 400 });
  }
  const extension = allowedTypes[file.type];
  if (!extension) {
    return Response.json({ error: "Formato no permitido. Usa PDF, JPG, PNG o WebP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "El archivo debe pesar menos de 10 MB." }, { status: 400 });
  }

  const supabase = await createClient();
  const storagePath = `${entityType}/${entityId}/${Date.now()}-${randomUUID()}.${extension}`;
  const { error: storageError } = await supabase.storage
    .from("audit-evidence")
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (storageError) {
    return Response.json({ error: `No se pudo subir la evidencia: ${storageError.message}` }, { status: 400 });
  }

  try {
    await registerAuditEvidence({
      entityType,
      entityId,
      category,
      title,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      notes,
    });
  } catch (error) {
    await supabase.storage.from("audit-evidence").remove([storagePath]);
    const message = error instanceof Error ? error.message : "No se pudo registrar la evidencia.";
    return Response.json({ error: message }, { status: 400 });
  }

  revalidatePath("/gestion/expedientes");
  revalidatePath("/gestion/expedientes/reporte");
  revalidatePath("/gestion/auditoria");
  return Response.json({ ok: true }, { status: 201 });
}
