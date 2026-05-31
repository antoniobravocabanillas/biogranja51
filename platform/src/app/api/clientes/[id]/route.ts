import { revalidatePath } from "next/cache";
import { isCustomerSegment, type Customer } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import { updateCustomer } from "@/lib/commerce-store";

type CustomerUpdateRequest = Partial<
  Pick<Customer, "name" | "phone" | "email" | "document" | "notes" | "segment" | "subscriptionInterest">
>;

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
    const body = (await request.json()) as CustomerUpdateRequest;
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    if (!name || !phone || phone.replace(/\D/g, "").length < 9) {
      return Response.json(
        { error: "Nombre y celular válido son obligatorios." },
        { status: 400 },
      );
    }
    if (!isCustomerSegment(body.segment)) {
      return Response.json({ error: "El segmento seleccionado no es válido." }, { status: 400 });
    }

    const updated = await updateCustomer(id, {
      name,
      phone,
      email: body.email?.trim().toLowerCase() || null,
      document: body.document?.trim() || null,
      notes: body.notes?.trim() || "",
      segment: body.segment,
      subscriptionInterest: body.subscriptionInterest ?? false,
    });
    revalidatePath("/gestion/clientes");
    return Response.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el cliente.";
    return Response.json({ error: message }, { status: 400 });
  }
}
