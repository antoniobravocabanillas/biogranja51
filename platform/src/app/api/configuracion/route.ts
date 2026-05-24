import { revalidatePath } from "next/cache";
import type { DeliveryZone, PaymentMethod } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import {
  getCommerceState,
  getStorefrontState,
  updateDeliveryZones,
  updatePaymentMethods,
} from "@/lib/commerce-store";

export async function GET() {
  return Response.json(await getStorefrontState());
}

export async function PATCH(request: Request) {
  const unauthorized = await requireAdminWrites();
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await request.json()) as {
    deliveryZones?: DeliveryZone[];
    paymentMethods?: PaymentMethod[];
  };

  if (body.deliveryZones) {
    const invalidZone = body.deliveryZones.some(
      (zone) =>
        !zone.id ||
        !zone.name?.trim() ||
        !Number.isFinite(zone.baseFee) ||
        zone.baseFee < 0 ||
        (zone.freeFrom !== null &&
          (!Number.isFinite(zone.freeFrom) || zone.freeFrom < 0)),
    );
    if (invalidZone) {
      return Response.json({ error: "La configuración de zonas no es válida." }, { status: 400 });
    }
    await updateDeliveryZones(body.deliveryZones);
  }
  if (body.paymentMethods) {
    const invalidPayment = body.paymentMethods.some(
      (payment) => !payment.id || !payment.name?.trim(),
    );
    if (invalidPayment) {
      return Response.json({ error: "La configuración de pagos no es válida." }, { status: 400 });
    }
    await updatePaymentMethods(body.paymentMethods);
  }

  revalidatePath("/");
  revalidatePath("/gestion/configuracion");
  return Response.json(await getCommerceState());
}
