import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createProduct, listVisibleProducts } from "@/lib/commerce-store";
import { requireAdminWrites } from "@/lib/admin-guard";
import { isOriginType, isPriceUnit, type Product } from "@/domain/commerce";

export async function GET() {
  return Response.json(await listVisibleProducts());
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = (await request.json()) as Partial<Product>;
    const name = body.name?.trim();
    const sku = body.sku?.trim().toUpperCase();
    if (!name || !sku || !body.presentation) {
      return Response.json({ error: "Nombre, SKU y presentación son obligatorios." }, { status: 400 });
    }

    if (body.originType && !isOriginType(body.originType)) {
      return Response.json({ error: "El origen indicado no es válido." }, { status: 400 });
    }
    if (body.priceUnit && !isPriceUnit(body.priceUnit)) {
      return Response.json({ error: "La unidad de venta no es válida." }, { status: 400 });
    }
    if (body.price !== null && body.price !== undefined && (!Number.isFinite(body.price) || body.price < 0)) {
      return Response.json({ error: "El precio debe ser un importe válido." }, { status: 400 });
    }
    if (body.portionGrams !== null && body.portionGrams !== undefined && (!Number.isFinite(body.portionGrams) || body.portionGrams <= 0)) {
      return Response.json({ error: "El peso de presentación no es válido." }, { status: 400 });
    }

    const product: Product = {
      id: `prd-${randomUUID()}`,
      sku,
      name,
      category: body.category?.trim() || "Otros",
      originType: body.originType || "pending_confirmation",
      description: body.description?.trim() || "",
      presentation: body.presentation.trim(),
      priceUnit: body.priceUnit || "unit",
      price: typeof body.price === "number" ? body.price : null,
      portionGrams: typeof body.portionGrams === "number" ? body.portionGrams : null,
      imageUrl: body.imageUrl?.trim() || null,
      active: body.active ?? true,
      subscriptionEligible: body.subscriptionEligible ?? false,
      traceable: body.traceable ?? true,
    };
    const created = await createProduct(product);
    revalidatePath("/");
    revalidatePath("/gestion/productos");
    return Response.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el producto.";
    return Response.json({ error: message }, { status: 400 });
  }
}
