import { revalidatePath } from "next/cache";
import { isOriginType, isPriceUnit, type Product } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { deleteProduct, updateProduct } from "@/lib/commerce-store";

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
    const updates = (await request.json()) as Partial<Product>;
    if (updates.originType !== undefined && !isOriginType(updates.originType)) {
      return Response.json({ error: "El origen indicado no es válido." }, { status: 400 });
    }
    if (updates.priceUnit !== undefined && !isPriceUnit(updates.priceUnit)) {
      return Response.json({ error: "La unidad de venta no es válida." }, { status: 400 });
    }
    if (updates.price !== null && updates.price !== undefined && (!Number.isFinite(updates.price) || updates.price < 0)) {
      return Response.json({ error: "El precio debe ser un importe válido." }, { status: 400 });
    }
    if (updates.portionGrams !== null && updates.portionGrams !== undefined && (!Number.isFinite(updates.portionGrams) || updates.portionGrams <= 0)) {
      return Response.json({ error: "El peso de presentación no es válido." }, { status: 400 });
    }
    const product = await updateProduct(id, updates);
    revalidatePath("/");
    revalidatePath("/gestion/productos");
    return Response.json(product);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el producto.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;
  await deleteProduct(id);
  revalidatePath("/");
  revalidatePath("/gestion/productos");
  return Response.json({ ok: true });
}
