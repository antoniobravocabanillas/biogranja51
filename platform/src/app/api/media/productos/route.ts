import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { requireAdminWrites } from "@/lib/admin-guard";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.formData();
  const image = body.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "Selecciona una imagen." }, { status: 400 });
  }

  const extension = allowedTypes[image.type];
  if (!extension) {
    return Response.json(
      { error: "Formato no permitido. Usa JPG, PNG o WebP." },
      { status: 400 },
    );
  }
  if (image.size > 4 * 1024 * 1024) {
    return Response.json({ error: "La imagen debe pesar menos de 4 MB." }, { status: 400 });
  }

  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const storagePath = `productos/${filename}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(storagePath, await image.arrayBuffer(), {
        contentType: image.type,
        upsert: false,
      });
    if (error) {
      return Response.json({ error: `No se pudo subir la imagen: ${error.message}` }, { status: 400 });
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(storagePath);
    return Response.json({ imageUrl: data.publicUrl }, { status: 201 });
  }

  const directory = path.join(process.cwd(), "public", "uploads", "productos");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), Buffer.from(await image.arrayBuffer()));
  return Response.json({ imageUrl: `/uploads/productos/${filename}` }, { status: 201 });
}
