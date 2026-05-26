import { revalidatePath } from "next/cache";
import { saveCustomerPortalProfile } from "@/lib/commerce-store";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return Response.json({ error: "Inicia sesión para actualizar tu perfil." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      phone?: string;
      address?: string;
      deliveryZoneId?: string;
      paymentMethodId?: string;
    };
    if (
      !body.name?.trim() ||
      !body.phone?.trim() ||
      !body.address?.trim() ||
      !body.deliveryZoneId ||
      !body.paymentMethodId
    ) {
      return Response.json({ error: "Completa tus datos habituales de compra." }, { status: 400 });
    }
    const profile = await saveCustomerPortalProfile({
      name: body.name.trim(),
      phone: body.phone.trim(),
      address: body.address.trim(),
      deliveryZoneId: body.deliveryZoneId,
      paymentMethodId: body.paymentMethodId,
    });
    revalidatePath("/mi-cuenta");
    revalidatePath("/");
    return Response.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el perfil.";
    return Response.json({ error: message }, { status: 400 });
  }
}
