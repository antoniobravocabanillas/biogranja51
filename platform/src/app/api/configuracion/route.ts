import { revalidatePath } from "next/cache";
import type { DeliveryProfile, DeliveryZone, PaymentMethod } from "@/domain/commerce";
import { requireAdminWrites } from "@/lib/admin-guard";
import {
  getCommerceState,
  getStorefrontState,
  updateDeliveryZones,
  updateDeliveryProfiles,
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
    deliveryProfiles?: DeliveryProfile[];
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
  if (body.deliveryProfiles) {
    const invalidProfile = body.deliveryProfiles.some(
      (profile) =>
        !profile.id ||
        !profile.code?.trim() ||
        !profile.name?.trim() ||
        !profile.vehicleReference?.trim(),
    );
    if (invalidProfile) {
      return Response.json({ error: "La configuración de delivery no es válida." }, { status: 400 });
    }
    await updateDeliveryProfiles(body.deliveryProfiles);
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
